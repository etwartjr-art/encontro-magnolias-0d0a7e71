// Sincroniza vendas da Greenn com a tabela inscricoes.
// Puxa via API (sales:read), casa por sale_id/email/celular e cria/atualiza como pago.
// Uso: POST /sync-greenn-sales   (auth admin obrigatória)
// Query opcional: ?discover=1 → só devolve o payload cru da Greenn pra inspecionar
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Extrai apenas URLs https:// válidas do valor configurado (ignora lixo
// tipo "curl -H ..." que possa ter sido colado no secret por engano).
const extractUrls = (raw?: string): string[] => {
  if (!raw) return [];
  const matches = raw.match(/https:\/\/[^\s"'`]+/g) ?? [];
  return matches.map((u) => u.replace(/\/+$/, ""));
};
const configuredGreennApis = extractUrls(Deno.env.get("GREENN_API_BASE"));
const DEFAULT_GREENN_CANDIDATES = [
  "https://apiadm.greenn.com.br/api/v1",
  "https://api.greenn.com.br/v1",
  "https://api.gdigital.com.br/v1",
  "https://api.gdigital.com.br",
];
const GREENN_API_CANDIDATES = Array.from(new Set([
  ...configuredGreennApis,
  ...DEFAULT_GREENN_CANDIDATES,
]));
const GREENN_FETCH_TIMEOUT_MS = Number(Deno.env.get("GREENN_FETCH_TIMEOUT_MS") ?? "7000");
const GREENN_FETCH_RETRIES = Number(Deno.env.get("GREENN_FETCH_RETRIES") ?? "1");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const normalizePhone = (raw: unknown): string => {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.length === 13 && d.startsWith("55")) return d;
  if (d.length === 11) return `55${d}`;
  if (d.length === 10) return `55${d.slice(0, 2)}9${d.slice(2)}`;
  return d;
};

const PAID = new Set(["approved", "paid", "completed", "confirmed"]);

const greennUnavailableMessage =
  "Não foi possível conectar à API da Greenn agora. A sincronização foi registrada como falha e pode ser tentada novamente.";
const greennUnavailableAction =
  "Ajuste na Greenn: confirme se a API de vendas está habilitada para a conta/chave usada, se o endpoint da API continua correto e mantenha o webhook de vendas saleUpdated ativo para atualizar pagamentos mesmo quando a API de consulta estiver indisponível.";

const pick = (obj: unknown, keys: string[]): unknown => {
  if (!obj || typeof obj !== "object") return undefined;
  const wanted = keys.map((k) => k.toLowerCase());
  const stack: unknown[] = [obj];
  while (stack.length) {
    const cur = stack.pop() as Record<string, unknown>;
    for (const k of Object.keys(cur)) {
      if (wanted.includes(k.toLowerCase()) && cur[k] != null && cur[k] !== "") return cur[k];
      if (cur[k] && typeof cur[k] === "object") stack.push(cur[k]);
    }
  }
  return undefined;
};

Deno.serve(async (req) => {
  try {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const startedAt = Date.now();
  let origem: "cron" | "manual" | "discover" = "cron";

  const apiKey = Deno.env.get("GREENN_API_KEY");

  const url = new URL(req.url);
  const discover = url.searchParams.get("discover") === "1";
  const probe = url.searchParams.get("probe") === "1";
  if (discover) origem = "discover";

  // Auth OBRIGATÓRIA para TODOS os modos (inclusive discover/probe) — esses modos de debug
  // consomem a API real da Greenn com credenciais do servidor e não podem ser acionados
  // anonimamente. Aceita admin JWT ou header X-Cron-Secret.
  {
    const cronSecret = Deno.env.get("SYNC_CRON_SECRET");
    const internalToken = Deno.env.get("SYNC_INTERNAL_TOKEN");
    const pgCronKey = Deno.env.get("SYNC_PG_CRON_KEY");
    const providedCron = req.headers.get("x-cron-secret") ?? "";
    const isCron =
      (Boolean(cronSecret) && providedCron === cronSecret) ||
      (Boolean(internalToken) && providedCron === internalToken) ||
      (Boolean(pgCronKey) && providedCron === pgCronKey);
    if (!discover) origem = isCron ? "cron" : "manual";

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ error: "no_auth" }, 401);
      const { data: userRes, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userRes?.user) return json({ error: "invalid_auth" }, 401);
      const { data: r } = await admin.from("user_roles").select("id").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
      if (!r) return json({ error: "forbidden" }, 403);
    }
  }

  // Modo webhook-only: pula a chamada à API da Greenn e confia apenas no webhook saleUpdated
  // para atualizar pagamentos. Útil quando a API pública está inacessível (DNS/timeout).
  // Ativa por env (GREENN_WEBHOOK_ONLY=1/true) ou por query (?webhook_only=1 / ?mode=webhook).
  const webhookOnlyEnv = String(Deno.env.get("GREENN_WEBHOOK_ONLY") ?? "").toLowerCase();
  const webhookOnlyFlag =
    webhookOnlyEnv === "1" || webhookOnlyEnv === "true" || webhookOnlyEnv === "yes";
  const webhookOnlyQuery =
    url.searchParams.get("webhook_only") === "1" ||
    url.searchParams.get("mode") === "webhook";
  const webhookOnly = !discover && !probe && (webhookOnlyFlag || webhookOnlyQuery);

  // Modo probe: testa vários hosts/paths e tokens para descobrir a combinação correta da API.
  if (probe) {
    const bases = [
      "https://api.greenn.com.br/v1",
      "https://api.greenn.com.br",
      "https://api.gdigital.com.br/v1",
      "https://api.gdigital.com.br",
    ];
    const tokens: { label: string; value: string | undefined }[] = [
      { label: "GREENN_API_KEY", value: apiKey },
      { label: "GREENN_BEARER_TOKEN", value: Deno.env.get("GREENN_BEARER_TOKEN") },
      { label: "GREENN_PUBLIC_KEY", value: Deno.env.get("GREENN_PUBLIC_KEY") },
    ].filter((t) => Boolean(t.value));
    const results: unknown[] = [];
    for (const base of bases) {
      for (const tok of tokens) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        try {
          const r = await fetch(`${base}/sales?limit=1`, {
            headers: { Authorization: `Bearer ${tok.value}`, Accept: "application/json" },
            signal: ctrl.signal,
          });
          const txt = await r.text();
          results.push({ base, token: tok.label, status: r.status, sample: txt.slice(0, 200) });
        } catch (e) {
          results.push({ base, token: tok.label, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
        } finally {
          clearTimeout(t);
        }
      }
    }
    return json({ ok: true, results });
  }

  // Após autenticação: se webhook-only estiver ativo, registra o run como sucesso (sem tocar na API)
  // e devolve um payload indicando que a atualização de pagamentos depende apenas do webhook.
  if (webhookOnly) {
    await recordRun({
      origem,
      sucesso: true,
      startedAt,
      detalhes: {
        modo: "webhook_only",
        motivo:
          "Sincronização ativa via webhook saleUpdated apenas — a chamada à API da Greenn foi ignorada.",
        origem_flag: webhookOnlyQuery ? "query" : "env",
      },
    });
    return json({
      ok: true,
      mode: "webhook_only",
      message:
        "Modo webhook-only ativo: pagamentos continuam sendo atualizados pelo webhook saleUpdated da Greenn. A consulta à API foi ignorada.",
      stats: { total: 0, criadas: 0, atualizadas: 0, ignoradas: 0, erros: 0 },
    });
  }

  // A API é necessária apenas fora do modo webhook-only. Se a chave não estiver configurada,
  // registra o run como erro (sem 503) para o cron não ficar falhando silenciosamente.
  if (!apiKey) {
    await recordRun({
      origem,
      sucesso: false,
      erro_mensagem: "GREENN_API_KEY não configurada",
      startedAt,
      detalhes: {
        motivo:
          "A chave da API da Greenn não está definida. Configure GREENN_API_KEY ou ative GREENN_WEBHOOK_ONLY=1 para operar apenas por webhook.",
      },
    });
    return json({
      ok: false,
      error: "missing_GREENN_API_KEY",
      message:
        "GREENN_API_KEY não configurada. Configure a chave ou ative o modo webhook-only (GREENN_WEBHOOK_ONLY=1).",
    });
  }

  // Tenta endpoint principal /sales. Se a API real usar outro path, o discover ajuda a descobrir.
  const respResult = await fetchGreenn(`/sales?limit=100`, apiKey);
  if (!respResult.ok) {
    await recordRun({
      origem,
      sucesso: false,
      erro_mensagem: formatGreennUnavailableError(respResult.message),
      startedAt,
      detalhes: {
        endpoints_testados: GREENN_API_CANDIDATES.map((base) => `${base}/sales?limit=100`),
        timeout_ms: GREENN_FETCH_TIMEOUT_MS,
        tentativas: GREENN_FETCH_RETRIES + 1,
        tipo_erro: classifyGreennFetchError(respResult.message),
        motivo: greennUnavailableMessage,
        ajuste_greenn: greennUnavailableAction,
      },
    });
    return json({
      ok: false,
      error: "greenn_unreachable",
      message: greennUnavailableMessage,
      action: greennUnavailableAction,
      type: classifyGreennFetchError(respResult.message),
      details: respResult.message,
    });
  }
  const resp = respResult.response;
  const bodyText = await resp.text();
  let body: unknown = null;
  try { body = JSON.parse(bodyText); } catch { /* ignore */ }

  if (discover) {
    // Também sonda endpoints de cliente para descobrir onde ficam nome/email/telefone
    const list0: any = Array.isArray(body) ? body : (body as any)?.data ?? (body as any)?.sales ?? [];
    const sampleClientId = Array.isArray(list0) && list0[0]?.client_id;
    const probes: any[] = [];
    if (sampleClientId) {
      for (const path of [`/clients/${sampleClientId}`, `/customers/${sampleClientId}`, `/clients?id=${sampleClientId}`, `/sales/${list0[0]?.id}`]) {
        const r = await fetchGreenn(path, apiKey);
        if (r.ok) {
          const t = await r.response.text();
          let parsed: any = null; try { parsed = JSON.parse(t); } catch {}
          probes.push({ path, status: r.response.status, sample: parsed ?? t.slice(0, 1500) });
        } else {
          probes.push({ path, error: r.message.slice(0, 300) });
        }
      }
    }
    return json({ status: resp.status, contentType: resp.headers.get("content-type"), sample: body ?? bodyText.slice(0, 4000), probes });
  }
  if (!resp.ok) {
    await recordRun({
      origem, sucesso: false, http_status: resp.status,
      erro_mensagem: `greenn_error ${resp.status}: ${bodyText.slice(0, 500)}`,
      startedAt,
    });
    return json({ error: "greenn_error", status: resp.status, body: bodyText.slice(0, 2000) }, 502);
  }

  // Tenta encontrar o array de vendas em várias formas comuns
  const list: unknown[] =
    (Array.isArray(body) ? body : null) ??
    (Array.isArray((body as any)?.data) ? (body as any).data : null) ??
    (Array.isArray((body as any)?.sales) ? (body as any).sales : null) ??
    (Array.isArray((body as any)?.data?.sales) ? (body as any).data.sales : null) ??
    [];

  const stats = { total: list.length, criadas: 0, atualizadas: 0, ignoradas: 0, erros: 0 };
  const detalhes: Array<Record<string, unknown>> = [];

  for (const saleRaw of list) {
    let sale: any = saleRaw;
    const saleId = String(pick(sale, ["sale_id", "id", "code"]) ?? "").trim();
    if (!saleId) { stats.ignoradas++; continue; }

    const clientObj = (sale as any)?.client && typeof (sale as any).client === "object" ? (sale as any).client : null;
    let nome = String(clientObj?.name ?? pick(sale, ["buyer_name", "customer_name", "client_name"]) ?? "").trim();
    let email = String(clientObj?.email ?? pick(sale, ["email"]) ?? "").toLowerCase().trim();
    let celular = normalizePhone(clientObj?.phone ?? pick(sale, ["phone", "telephone", "cellphone", "celular", "whatsapp"]));

    // Se a listagem não trouxe dados do cliente (schema da Greenn v1), busca o detalhe /sales/{id}
    if (!nome || !email) {
      const detail = await fetchGreenn(`/sales/${saleId}`, apiKey);
      if (detail.ok) {
        try {
          const dText = await detail.response.text();
          const dJson = JSON.parse(dText);
          sale = dJson;
          const c = (sale as any)?.client && typeof (sale as any).client === "object" ? (sale as any).client : null;
          nome = nome || String(c?.name ?? pick(sale, ["buyer_name", "customer_name", "client_name"]) ?? "").trim();
          email = email || String(c?.email ?? pick(sale, ["email"]) ?? "").toLowerCase().trim();
          celular = celular || normalizePhone(c?.phone ?? pick(sale, ["phone", "telephone", "cellphone", "celular", "whatsapp"]));
        } catch { /* segue com o que tem */ }
      }
    }

    const rawStatus = String(pick(sale, ["currentStatus", "current_status", "status", "sale_status"]) ?? "").toLowerCase();
    const metodo = String(pick(sale, ["payment_method", "method"]) ?? "").trim() || null;
    const valorRaw = Number(pick(sale, ["net_amount", "amount", "total", "value"]) ?? 0);
    let valor = valorRaw > 1000 ? valorRaw / 100 : valorRaw; // heurística: centavos
    // Sempre armazenar valor líquido: se veio bruto (~39,90), converter para líquido (36,90)
    if (Math.abs(valor - 39.9) < 0.5) valor = 36.9;
    const paidAt = pick(sale, ["paid_at", "payment_date", "approved_at", "updated_at", "date"]);

    const isPaid = PAID.has(rawStatus);

    // Match: primeiro por sale_id; fallback por email; fallback por telefone.
    type ExistingRow = {
      id: string;
      status: string;
      nome: string;
      email: string;
      celular: string;
      valor: number | null;
      greenn_sale_id: string | null;
      pago_em: string | null;
      metodo_pagamento: string | null;
    };
    let existing: ExistingRow | null = null;
    let matchRule: "sale_id" | "email" | "phone" | "none" = "none";
    const selectCols = "id, status, nome, email, celular, valor, greenn_sale_id, pago_em, metodo_pagamento";
    {
      const { data } = await admin
        .from("inscricoes")
        .select(selectCols)
        .eq("greenn_sale_id", saleId)
        .maybeSingle();
      if (data) { existing = data as ExistingRow; matchRule = "sale_id"; }
    }
    if (!existing && email) {
      const { data } = await admin
        .from("inscricoes")
        .select(selectCols)
        .is("greenn_sale_id", null)
        .eq("email", email)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) { existing = data as ExistingRow; matchRule = "email"; }
    }
    if (!existing && celular) {
      const { data } = await admin
        .from("inscricoes")
        .select(selectCols)
        .is("greenn_sale_id", null)
        .eq("celular", celular)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) { existing = data as ExistingRow; matchRule = "phone"; }
    }

    const pagoEmNovo = paidAt ? new Date(String(paidAt)).toISOString() : new Date().toISOString();

    if (existing) {
      const buyer = { nome, email, celular };
      if (isPaid) {
        const valorGreenn = isFinite(valor) && valor > 0 ? valor : null;
        const patch: Record<string, unknown> = {
          greenn_sale_id: saleId,
          metodo_pagamento: metodo,
          greenn_payload: sale as any,
        };
        const antes: Record<string, unknown> = {
          status: existing.status,
          valor: existing.valor,
          greenn_sale_id: existing.greenn_sale_id,
          pago_em: existing.pago_em,
          metodo_pagamento: existing.metodo_pagamento,
        };
        const depois: Record<string, unknown> = {
          status: existing.status,
          valor: existing.valor,
          greenn_sale_id: saleId,
          pago_em: existing.pago_em,
          metodo_pagamento: metodo,
        };
        // Sempre reflete o valor real cobrado na Greenn quando disponível
        if (valorGreenn != null && Math.abs(Number(existing.valor ?? 0) - valorGreenn) > 0.005) {
          patch.valor = valorGreenn;
          depois.valor = valorGreenn;
        }
        if (existing.status !== "pago") {
          patch.status = "pago";
          patch.pago_em = pagoEmNovo;
          depois.status = "pago";
          depois.pago_em = pagoEmNovo;
        }
        const { error } = await admin.from("inscricoes").update(patch).eq("id", existing.id);
        if (error) {
          stats.erros++;
          detalhes.push({
            saleId, acao: "erro_update", match_rule: matchRule, id: existing.id,
            inscricao: { nome: existing.nome, email: existing.email, celular: existing.celular },
            buyer, antes, tentativa_depois: depois, erro: error.message,
          });
        } else {
          stats.atualizadas++;
          detalhes.push({
            saleId, acao: "atualizada", match_rule: matchRule, id: existing.id,
            inscricao: { nome: existing.nome, email: existing.email, celular: existing.celular },
            buyer, antes, depois,
          });
        }
      } else {
        stats.ignoradas++;
        detalhes.push({
          saleId, acao: "ignorada_nao_paga", match_rule: matchRule, id: existing.id,
          inscricao: { nome: existing.nome, email: existing.email, celular: existing.celular },
          buyer, status_greenn: rawStatus,
          motivo: `venda com status "${rawStatus}" não é considerada paga`,
        });
      }
      continue;
    }


    if (!isPaid) {
      stats.ignoradas++;
      detalhes.push({
        saleId, acao: "ignorada_nao_paga", match_rule: "none",
        buyer: { nome, email, celular }, status_greenn: rawStatus,
        motivo: `sem inscrição correspondente e status "${rawStatus}" não é pago`,
      });
      continue;
    }
    if (!nome || (!email && !celular)) {
      stats.ignoradas++;
      detalhes.push({
        saleId, acao: "ignorada", match_rule: "none",
        buyer: { nome, email, celular },
        motivo: "dados insuficientes (nome e email/telefone obrigatórios)",
      });
      continue;
    }

    const { data: inserted, error } = await admin.from("inscricoes").insert({
      nome,
      email: email || `sem-email-${saleId}@magnolias.local`,
      celular: celular || "5500000000000",
      valor: isFinite(valor) && valor > 0 ? valor : 39.9,
      status: "pago",
      metodo_pagamento: metodo,
      greenn_sale_id: saleId,
      pago_em: pagoEmNovo,
      greenn_payload: sale as any,
    }).select("id").maybeSingle();

    if (error) {
      stats.erros++;
      detalhes.push({
        saleId, acao: "erro_insert", match_rule: "none",
        buyer: { nome, email, celular }, erro: error.message,
      });
    } else {
      stats.criadas++;
      detalhes.push({
        saleId, acao: "criada", match_rule: "none", id: inserted?.id,
        buyer: { nome, email, celular },
        depois: { status: "pago", greenn_sale_id: saleId, pago_em: pagoEmNovo, metodo_pagamento: metodo },
      });
    }
  }



  await recordRun({
    origem, sucesso: stats.erros === 0, http_status: resp.status,
    stats, detalhes: detalhes.slice(0, 50), startedAt,
  });

  return json({ ok: true, stats, detalhes });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("sync-greenn-sales unhandled error", msg);
    try {
      await recordRun({
        origem: "manual", sucesso: false,
        erro_mensagem: `unhandled: ${msg}`.slice(0, 500),
        startedAt: Date.now(),
      });
    } catch { /* ignore */ }
    return json({ ok: false, error: "sync_failed", message: msg });
  }
});

async function fetchGreenn(path: string, apiKey: string): Promise<
  | { ok: true; response: Response; endpoint: string }
  | { ok: false; message: string }
> {
  const errors: string[] = [];

  for (const base of GREENN_API_CANDIDATES) {
    const endpoint = `${base}${path}`;
    for (let attempt = 0; attempt <= GREENN_FETCH_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GREENN_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          signal: controller.signal,
        });
        return { ok: true, response, endpoint };
      } catch (e) {
        const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        errors.push(`${endpoint} tentativa ${attempt + 1}: ${message}`);
        if (attempt < GREENN_FETCH_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return { ok: false, message: errors.join(" | ") };
}

function classifyGreennFetchError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("abort") || lower.includes("timed out") || lower.includes("timeout")) {
    return "timeout_api_greenn";
  }
  if (lower.includes("dns") || lower.includes("resolve")) return "dns_api_greenn";
  if (lower.includes("connect")) return "conexao_api_greenn";
  return "api_greenn_indisponivel";
}

function formatGreennUnavailableError(message: string) {
  const type = classifyGreennFetchError(message);
  const readable: Record<string, string> = {
    timeout_api_greenn: "timeout ao conectar na API da Greenn",
    dns_api_greenn: "DNS da API da Greenn não resolveu",
    conexao_api_greenn: "conexão com a API da Greenn falhou",
    api_greenn_indisponivel: "API da Greenn indisponível",
  };
  return `greenn_unreachable (${type}): ${readable[type]}. ${greennUnavailableAction}`.slice(0, 500);
}

async function recordRun(opts: {
  origem: string;
  sucesso: boolean;
  http_status?: number;
  erro_mensagem?: string;
  stats?: { total: number; criadas: number; atualizadas: number; ignoradas: number; erros: number };
  detalhes?: unknown;
  startedAt: number;
}) {
  try {
    const now = Date.now();
    await admin.from("sync_runs").insert({
      origem: opts.origem,
      sucesso: opts.sucesso,
      http_status: opts.http_status ?? null,
      erro_mensagem: opts.erro_mensagem ?? null,
      total: opts.stats?.total ?? 0,
      criadas: opts.stats?.criadas ?? 0,
      atualizadas: opts.stats?.atualizadas ?? 0,
      ignoradas: opts.stats?.ignoradas ?? 0,
      erros: opts.stats?.erros ?? 0,
      detalhes: (opts.detalhes ?? null) as any,
      finalizado_em: new Date(now).toISOString(),
      duracao_ms: now - opts.startedAt,
    });
  } catch (e) {
    console.error("failed to record sync_run", e);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

