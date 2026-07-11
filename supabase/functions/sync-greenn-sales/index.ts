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

const GREENN_API = Deno.env.get("GREENN_API_BASE") ?? "https://api.greenn.com.br/v1";

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const startedAt = Date.now();
  let origem: "cron" | "manual" | "discover" = "cron";

  const apiKey = Deno.env.get("GREENN_API_KEY");
  if (!apiKey) return json({ error: "missing_GREENN_API_KEY" }, 503);

  const url = new URL(req.url);
  const discover = url.searchParams.get("discover") === "1";
  if (discover) origem = "discover";

  // Auth: obrigatória exceto no modo discover (que só ecoa a resposta da Greenn, sem tocar no DB)
  // Também aceita chamada do cron via header X-Cron-Secret
  if (!discover) {
    const cronSecret = Deno.env.get("SYNC_CRON_SECRET");
    const providedCron = req.headers.get("x-cron-secret") ?? "";
    const isCron = Boolean(cronSecret) && providedCron === cronSecret;
    origem = isCron ? "cron" : "manual";

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



  // Tenta endpoint principal /sales. Se a API real usar outro path, o discover ajuda a descobrir.
  const resp = await fetch(`${GREENN_API}/sales?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const bodyText = await resp.text();
  let body: unknown = null;
  try { body = JSON.parse(bodyText); } catch { /* ignore */ }

  if (discover) {
    return json({ status: resp.status, contentType: resp.headers.get("content-type"), sample: body ?? bodyText.slice(0, 4000) });
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

  for (const sale of list) {
    const saleId = String(pick(sale, ["sale_id", "id", "code"]) ?? "").trim();
    const rawStatus = String(pick(sale, ["currentStatus", "current_status", "status", "sale_status"]) ?? "").toLowerCase();
    const nome = String(pick(sale, ["name", "buyer_name", "customer_name", "client_name"]) ?? "").trim();
    const email = String(pick(sale, ["email"]) ?? "").toLowerCase().trim();
    const celular = normalizePhone(pick(sale, ["phone", "telephone", "cellphone", "celular", "whatsapp"]));
    const metodo = String(pick(sale, ["payment_method", "method"]) ?? "").trim() || null;
    const valorRaw = Number(pick(sale, ["net_amount", "amount", "total", "value"]) ?? 0);
    const valor = valorRaw > 1000 ? valorRaw / 100 : valorRaw; // heurística: se vier em centavos
    const paidAt = pick(sale, ["paid_at", "payment_date", "approved_at", "updated_at", "date"]);

    if (!saleId) { stats.ignoradas++; continue; }

    const isPaid = PAID.has(rawStatus);

    // Já existe? Primeiro por sale_id; se não, cai para email/telefone (inscrição feita no site e paga fora do fluxo).
    let existing: { id: string; status: string } | null = null;
    {
      const { data } = await admin
        .from("inscricoes")
        .select("id, status")
        .eq("greenn_sale_id", saleId)
        .maybeSingle();
      existing = (data as any) ?? null;
    }
    if (!existing && (email || celular)) {
      const orParts: string[] = [];
      if (email) orParts.push(`email.eq.${email}`);
      if (celular) orParts.push(`celular.eq.${celular}`);
      const { data } = await admin
        .from("inscricoes")
        .select("id, status")
        .is("greenn_sale_id", null)
        .or(orParts.join(","))
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = (data as any) ?? null;
    }

    if (existing) {
      if (isPaid) {
        const patch: Record<string, unknown> = {
          greenn_sale_id: saleId,
          metodo_pagamento: metodo,
          greenn_payload: sale as any,
        };
        if (existing.status !== "pago") {
          patch.status = "pago";
          patch.pago_em = paidAt ? new Date(String(paidAt)).toISOString() : new Date().toISOString();
        }
        const { error } = await admin.from("inscricoes").update(patch).eq("id", existing.id);
        if (error) { stats.erros++; detalhes.push({ saleId, erro: error.message }); }
        else { stats.atualizadas++; detalhes.push({ saleId, acao: "atualizada", id: existing.id }); }
      } else {
        stats.ignoradas++;
      }
      continue;
    }


    if (!isPaid) { stats.ignoradas++; continue; }
    if (!nome || (!email && !celular)) { stats.ignoradas++; detalhes.push({ saleId, motivo: "dados_insuficientes" }); continue; }

    const { data: inserted, error } = await admin.from("inscricoes").insert({
      nome,
      email: email || `sem-email-${saleId}@magnolias.local`,
      celular: celular || "5500000000000",
      valor: isFinite(valor) && valor > 0 ? valor : 39.9,
      status: "pago",
      metodo_pagamento: metodo,
      greenn_sale_id: saleId,
      pago_em: paidAt ? new Date(String(paidAt)).toISOString() : new Date().toISOString(),
      greenn_payload: sale as any,
    }).select("id").maybeSingle();

    if (error) { stats.erros++; detalhes.push({ saleId, erro: error.message }); }
    else { stats.criadas++; detalhes.push({ saleId, acao: "criada", id: inserted?.id }); }
  }

  await recordRun({
    origem, sucesso: stats.erros === 0, http_status: resp.status,
    stats, detalhes: detalhes.slice(0, 50), startedAt,
  });

  return json({ ok: true, stats, detalhes });
});

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

