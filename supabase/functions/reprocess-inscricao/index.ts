// Reprocessa manualmente uma inscrição contra a Greenn.
// POST /reprocess-inscricao  body: { inscricaoId: string }
// Requer admin. Registra o resultado em sync_runs (origem="reprocesso").
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GREENN_API = Deno.env.get("GREENN_API_BASE") ?? "https://api.greenn.com.br/v1";
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
  "Não foi possível conectar à API da Greenn agora. O reprocessamento foi registrado como falha e pode ser tentado novamente.";
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const startedAt = Date.now();
  const apiKey = Deno.env.get("GREENN_API_KEY");
  if (!apiKey) return json({ error: "missing_GREENN_API_KEY" }, 503);

  // Auth admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "no_auth" }, 401);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return json({ error: "invalid_auth" }, 401);
  const { data: rr } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!rr) return json({ error: "forbidden" }, 403);

  let payload: { inscricaoId?: string } = {};
  try { payload = await req.json(); } catch { /* ignore */ }
  const inscricaoId = String(payload.inscricaoId ?? "").trim();
  if (!inscricaoId) return json({ error: "missing_inscricaoId" }, 400);

  const { data: insc, error: inscErr } = await admin
    .from("inscricoes")
    .select("id, status, nome, email, celular, valor, greenn_sale_id, pago_em, metodo_pagamento")
    .eq("id", inscricaoId)
    .maybeSingle();
  if (inscErr || !insc) {
    await recordRun({
      sucesso: false, erro: `inscricao_nao_encontrada: ${inscErr?.message ?? ""}`,
      startedAt, detalhes: [{ acao: "erro_reprocesso", id: inscricaoId, erro: "inscrição não encontrada" }],
    });
    return json({ error: "inscricao_nao_encontrada" }, 404);
  }

  const emailInsc = String(insc.email ?? "").toLowerCase().trim();
  const celularInsc = normalizePhone(insc.celular);

  // Busca venda: primeiro por sale_id salvo; senão varre lista e casa por email/celular.
  let sale: unknown = null;
  let matchRule: "sale_id" | "email" | "phone" | "none" = "none";
  const httpStatuses: number[] = [];

  if (insc.greenn_sale_id) {
    const saleResult = await fetchGreenn(`/sales/${encodeURIComponent(insc.greenn_sale_id)}`, apiKey);
    if (!saleResult.ok) {
      await recordRun({
        sucesso: false,
        erro: formatGreennUnavailableError(saleResult.message),
        startedAt,
        detalhes: [{ acao: "erro_reprocesso", id: insc.id, erro: greennUnavailableMessage, tipo_erro: classifyGreennFetchError(saleResult.message), ajuste_greenn: greennUnavailableAction }],
        erros: 1,
      });
      return json({ ok: false, error: "greenn_unreachable", message: greennUnavailableMessage, action: greennUnavailableAction, type: classifyGreennFetchError(saleResult.message), details: saleResult.message });
    }
    const r = saleResult.response;
    httpStatuses.push(r.status);
    if (r.ok) {
      const b = await r.json().catch(() => null);
      sale = (b && (b.data ?? b.sale ?? b)) ?? null;
      if (sale) matchRule = "sale_id";
    }
  }

  if (!sale) {
    const listResult = await fetchGreenn(`/sales?limit=200`, apiKey);
    if (!listResult.ok) {
      await recordRun({
        sucesso: false,
        erro: formatGreennUnavailableError(listResult.message),
        startedAt,
        detalhes: [{ acao: "erro_reprocesso", id: insc.id, erro: greennUnavailableMessage, tipo_erro: classifyGreennFetchError(listResult.message), ajuste_greenn: greennUnavailableAction }],
        erros: 1,
      });
      return json({ ok: false, error: "greenn_unreachable", message: greennUnavailableMessage, action: greennUnavailableAction, type: classifyGreennFetchError(listResult.message), details: listResult.message });
    }
    const r = listResult.response;
    httpStatuses.push(r.status);
    if (!r.ok) {
      const body = await r.text();
      await recordRun({
        sucesso: false, http_status: r.status, startedAt,
        erro: `greenn_error ${r.status}: ${body.slice(0, 300)}`,
        detalhes: [{ acao: "erro_reprocesso", id: insc.id, erro: `Greenn respondeu ${r.status}` }],
      });
      return json({ error: "greenn_error", status: r.status }, 502);
    }
    const body = await r.json().catch(() => null);
    const list: unknown[] =
      (Array.isArray(body) ? body : null) ??
      (Array.isArray((body as any)?.data) ? (body as any).data : null) ??
      (Array.isArray((body as any)?.sales) ? (body as any).sales : null) ??
      (Array.isArray((body as any)?.data?.sales) ? (body as any).data.sales : null) ??
      [];

    if (insc.greenn_sale_id) {
      const found = list.find((s) => String(pick(s, ["sale_id", "id", "code"]) ?? "") === insc.greenn_sale_id);
      if (found) { sale = found; matchRule = "sale_id"; }
    }
    if (!sale && emailInsc) {
      const found = list.find((s) => String(pick(s, ["email"]) ?? "").toLowerCase().trim() === emailInsc);
      if (found) { sale = found; matchRule = "email"; }
    }
    if (!sale && celularInsc) {
      const found = list.find(
        (s) => normalizePhone(pick(s, ["phone", "telephone", "cellphone", "celular", "whatsapp"])) === celularInsc,
      );
      if (found) { sale = found; matchRule = "phone"; }
    }
  }

  const antes = {
    status: insc.status,
    valor: insc.valor,
    greenn_sale_id: insc.greenn_sale_id,
    pago_em: insc.pago_em,
    metodo_pagamento: insc.metodo_pagamento,
  };

  if (!sale) {
    await recordRun({
      sucesso: false, http_status: httpStatuses.at(-1), startedAt,
      erro: "venda_nao_encontrada",
      detalhes: [{
        acao: "erro_reprocesso", id: insc.id, match_rule: "none", saleId: insc.greenn_sale_id ?? undefined,
        inscricao: { nome: insc.nome, email: insc.email, celular: insc.celular },
        antes, motivo: "nenhuma venda correspondente encontrada na Greenn",
      }],
    });
    return json({ ok: false, motivo: "venda_nao_encontrada" });
  }

  const saleId = String(pick(sale, ["sale_id", "id", "code"]) ?? "").trim();
  const rawStatus = String(pick(sale, ["currentStatus", "current_status", "status", "sale_status"]) ?? "").toLowerCase();
  const metodo = String(pick(sale, ["payment_method", "method"]) ?? "").trim() || null;
  const paidAt = pick(sale, ["paid_at", "payment_date", "approved_at", "updated_at", "date"]);
  const valorRaw = Number(pick(sale, ["net_amount", "amount", "total", "value"]) ?? 0);
  const valorGreenn = valorRaw > 1000 ? valorRaw / 100 : valorRaw;
  const isPaid = PAID.has(rawStatus);
  const buyer = {
    nome: String(pick(sale, ["name", "buyer_name", "customer_name", "client_name"]) ?? "").trim(),
    email: String(pick(sale, ["email"]) ?? "").toLowerCase().trim(),
    celular: normalizePhone(pick(sale, ["phone", "telephone", "cellphone", "celular", "whatsapp"])),
  };

  if (!isPaid) {
    await recordRun({
      sucesso: true, http_status: httpStatuses.at(-1), startedAt,
      detalhes: [{
        acao: "ignorada_nao_paga", id: insc.id, match_rule: matchRule, saleId,
        inscricao: { nome: insc.nome, email: insc.email, celular: insc.celular },
        buyer, antes, status_greenn: rawStatus,
        motivo: `venda com status "${rawStatus}" não é considerada paga`,
      }],
      ignoradas: 1,
    });
    return json({ ok: true, acao: "ignorada_nao_paga", status_greenn: rawStatus });
  }

  const pagoEmNovo = paidAt ? new Date(String(paidAt)).toISOString() : new Date().toISOString();
  const patch: Record<string, unknown> = {
    greenn_sale_id: saleId,
    metodo_pagamento: metodo,
    greenn_payload: sale as any,
  };
  const depois: Record<string, unknown> = {
    status: insc.status,
    valor: insc.valor,
    greenn_sale_id: saleId,
    pago_em: insc.pago_em,
    metodo_pagamento: metodo,
  };
  if (isFinite(valorGreenn) && valorGreenn > 0 && Math.abs(Number(insc.valor ?? 0) - valorGreenn) > 0.005) {
    patch.valor = valorGreenn;
    depois.valor = valorGreenn;
  }
  if (insc.status !== "pago") {
    patch.status = "pago";
    patch.pago_em = pagoEmNovo;
    depois.status = "pago";
    depois.pago_em = pagoEmNovo;
  }

  const { error: updErr } = await admin.from("inscricoes").update(patch).eq("id", insc.id);
  if (updErr) {
    await recordRun({
      sucesso: false, http_status: httpStatuses.at(-1), startedAt,
      erro: updErr.message,
      detalhes: [{
        acao: "erro_update", id: insc.id, match_rule: matchRule, saleId,
        inscricao: { nome: insc.nome, email: insc.email, celular: insc.celular },
        buyer, antes, tentativa_depois: depois, erro: updErr.message,
      }],
      erros: 1,
    });
    return json({ ok: false, error: updErr.message }, 500);
  }

  await recordRun({
    sucesso: true, http_status: httpStatuses.at(-1), startedAt,
    detalhes: [{
      acao: "atualizada", id: insc.id, match_rule: matchRule, saleId,
      inscricao: { nome: insc.nome, email: insc.email, celular: insc.celular },
      buyer, antes, depois,
    }],
    atualizadas: 1,
  });
  return json({ ok: true, acao: "atualizada", match_rule: matchRule, saleId });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("reprocess-inscricao unhandled error", msg);
    try {
      await recordRun({
        sucesso: false, erro: `unhandled: ${msg}`.slice(0, 500), startedAt: Date.now(),
        detalhes: [{ acao: "erro_reprocesso", erro: msg }],
      });
    } catch { /* ignore */ }
    return json({ ok: false, error: "reprocess_failed", message: msg });
  }
});

async function fetchGreenn(path: string, apiKey: string): Promise<
  | { ok: true; response: Response }
  | { ok: false; message: string }
> {
  const errors: string[] = [];

  for (let attempt = 0; attempt <= GREENN_FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GREENN_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${GREENN_API}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: controller.signal,
      });
      return { ok: true, response };
    } catch (e) {
      const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      errors.push(`tentativa ${attempt + 1}: ${message}`);
      if (attempt < GREENN_FETCH_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timeout);
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
  sucesso: boolean;
  http_status?: number;
  erro?: string;
  detalhes?: unknown;
  startedAt: number;
  atualizadas?: number;
  ignoradas?: number;
  erros?: number;
}) {
  try {
    const now = Date.now();
    await admin.from("sync_runs").insert({
      origem: "reprocesso",
      sucesso: opts.sucesso,
      http_status: opts.http_status ?? null,
      erro_mensagem: opts.erro ?? null,
      total: 1,
      criadas: 0,
      atualizadas: opts.atualizadas ?? 0,
      ignoradas: opts.ignoradas ?? 0,
      erros: opts.erros ?? 0,
      detalhes: (opts.detalhes ?? null) as any,
      finalizado_em: new Date(now).toISOString(),
      duracao_ms: now - opts.startedAt,
    });
  } catch (e) {
    console.error("failed to record sync_run", e);
  }
}
