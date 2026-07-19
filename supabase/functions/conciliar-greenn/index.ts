// Conciliação: compara vendas da Greenn (via API) com as inscrições do site
// e devolve as divergências categorizadas. Não modifica dados.
// Auth: admin JWT obrigatória.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const configuredGreennApi = Deno.env.get("GREENN_API_BASE")?.replace(/\/$/, "");
const DEFAULT_GREENN_CANDIDATES = [
  "https://api.greenn.com.br/v1",
  "https://api.gdigital.com.br/v1",
  "https://api.gdigital.com.br",
];
const GREENN_API_CANDIDATES = configuredGreennApi
  ? [configuredGreennApi, ...DEFAULT_GREENN_CANDIDATES.filter((b) => b !== configuredGreennApi)]
  : DEFAULT_GREENN_CANDIDATES;
const FETCH_TIMEOUT_MS = Number(Deno.env.get("GREENN_FETCH_TIMEOUT_MS") ?? "8000");
const FETCH_RETRIES = Number(Deno.env.get("GREENN_FETCH_RETRIES") ?? "1");

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
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    // Auth admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "no_auth" }, 401);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: "invalid_auth" }, 401);
    const { data: roleRow } = await admin.from("user_roles").select("id").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const apiKey = Deno.env.get("GREENN_API_KEY");

    type GreennSale = {
      sale_id: string;
      status: string;
      is_paid: boolean;
      nome: string;
      email: string;
      celular: string;
      valor: number | null;
      metodo: string | null;
      paid_at: string | null;
    };

    const mapSale = (sale: unknown): GreennSale => {
      const saleId = String(pick(sale, ["sale_id", "id", "code"]) ?? "").trim();
      const rawStatus = String(pick(sale, ["currentStatus", "current_status", "status", "sale_status"]) ?? "").toLowerCase();
      const nome = String(pick(sale, ["name", "buyer_name", "customer_name", "client_name"]) ?? "").trim();
      const email = String(pick(sale, ["email"]) ?? "").toLowerCase().trim();
      const celular = normalizePhone(pick(sale, ["phone", "telephone", "cellphone", "celular", "whatsapp"]));
      const metodo = String(pick(sale, ["payment_method", "method"]) ?? "").trim() || null;
      const valorRaw = Number(pick(sale, ["net_amount", "amount", "total", "value"]) ?? 0);
      const valor = isFinite(valorRaw) && valorRaw > 0 ? (valorRaw > 1000 ? valorRaw / 100 : valorRaw) : null;
      const paidAtRaw = pick(sale, ["paid_at", "payment_date", "approved_at", "updated_at", "date"]);
      const paid_at = paidAtRaw ? new Date(String(paidAtRaw)).toISOString() : null;
      return { sale_id: saleId, status: rawStatus, is_paid: PAID.has(rawStatus), nome, email, celular, valor, metodo, paid_at };
    };

    // Fonte de dados: tenta API Greenn; se falhar, cai pros webhook logs.
    let greenn: GreennSale[] = [];
    let fonte: "api" | "webhook_logs" = "api";
    let aviso: string | null = null;

    let apiOk = false;
    if (apiKey) {
      const fetched = await fetchGreenn(`/sales?limit=200`, apiKey);
      if (fetched.ok) {
        const respText = await fetched.response.text();
        let body: unknown = null;
        try { body = JSON.parse(respText); } catch { /* ignore */ }
        if (fetched.response.ok) {
          // deno-lint-ignore no-explicit-any
          const list: any[] =
            (Array.isArray(body) ? body : null) ??
            (Array.isArray((body as any)?.data) ? (body as any).data : null) ??
            (Array.isArray((body as any)?.sales) ? (body as any).sales : null) ??
            (Array.isArray((body as any)?.data?.sales) ? (body as any).data.sales : null) ??
            [];
          greenn = list.map(mapSale).filter((s) => s.sale_id);
          apiOk = true;
        }
      }
    }

    if (!apiOk) {
      // Fallback: usa greenn_webhook_logs (últimos 90 dias) para reconstruir as vendas.
      fonte = "webhook_logs";
      aviso = apiKey
        ? "A API da Greenn não respondeu — conciliação feita com base nos webhooks já recebidos. Pode não incluir vendas cujo webhook não chegou."
        : "GREENN_API_KEY não configurada — conciliação feita apenas com os webhooks recebidos. Pode não incluir vendas cujo webhook não chegou.";
      const { data: logs, error: logErr } = await admin
        .from("greenn_webhook_logs")
        .select("greenn_sale_id, status_recebido, payload, criado_em")
        .order("criado_em", { ascending: false })
        .limit(1000);
      if (logErr) return json({ ok: false, error: "db_error", message: logErr.message });
      const seen = new Set<string>();
      for (const log of logs ?? []) {
        const sale = mapSale(log.payload);
        // preserva o status/sale_id do log se o payload não tiver
        if (!sale.sale_id && log.greenn_sale_id) sale.sale_id = String(log.greenn_sale_id);
        if (!sale.status && log.status_recebido) {
          sale.status = String(log.status_recebido).toLowerCase();
          sale.is_paid = PAID.has(sale.status);
        }
        if (!sale.sale_id) continue;
        if (seen.has(sale.sale_id)) continue; // já pegamos o mais recente
        seen.add(sale.sale_id);
        greenn.push(sale);
      }
    }

    // Busca inscrições do site
    const { data: inscricoes, error: dbErr } = await admin
      .from("inscricoes")
      .select("id, nome, email, celular, valor, status, metodo_pagamento, greenn_sale_id, pago_em, criado_em");
    if (dbErr) return json({ ok: false, error: "db_error", message: dbErr.message });

    type Insc = NonNullable<typeof inscricoes>[number];
    const byId = new Map<string, Insc>();
    const byEmail = new Map<string, Insc[]>();
    const byPhone = new Map<string, Insc[]>();
    for (const i of inscricoes ?? []) {
      if (i.greenn_sale_id) byId.set(String(i.greenn_sale_id), i);
      const e = (i.email ?? "").toLowerCase();
      if (e) { const arr = byEmail.get(e) ?? []; arr.push(i); byEmail.set(e, arr); }
      const p = normalizePhone(i.celular);
      if (p) { const arr = byPhone.get(p) ?? []; arr.push(i); byPhone.set(p, arr); }
    }

    type Divergencia =
      | { tipo: "somente_greenn"; sale: GreennSale }
      | { tipo: "status_diferente"; sale: GreennSale; inscricao: Insc; match_rule: "sale_id" | "email" | "phone" }
      | { tipo: "valor_diferente"; sale: GreennSale; inscricao: Insc; match_rule: "sale_id" | "email" | "phone"; diferenca: number }
      | { tipo: "sem_sale_id"; sale: GreennSale; inscricao: Insc; match_rule: "email" | "phone" }
      | { tipo: "paga_sem_greenn"; inscricao: Insc };

    const divergencias: Divergencia[] = [];
    const matchedInscricaoIds = new Set<string>();
    const okPairs: { sale: GreennSale; inscricao: Insc }[] = [];

    for (const s of greenn) {
      if (!s.is_paid) continue; // conciliamos apenas vendas pagas
      let insc: Insc | undefined;
      let rule: "sale_id" | "email" | "phone" | null = null;
      insc = byId.get(s.sale_id);
      if (insc) rule = "sale_id";
      if (!insc && s.email) {
        const cand = byEmail.get(s.email) ?? [];
        insc = cand.find((c) => !c.greenn_sale_id) ?? cand[0];
        if (insc) rule = "email";
      }
      if (!insc && s.celular) {
        const cand = byPhone.get(s.celular) ?? [];
        insc = cand.find((c) => !c.greenn_sale_id) ?? cand[0];
        if (insc) rule = "phone";
      }

      if (!insc || !rule) {
        divergencias.push({ tipo: "somente_greenn", sale: s });
        continue;
      }

      matchedInscricaoIds.add(insc.id);

      if (insc.status !== "pago") {
        divergencias.push({ tipo: "status_diferente", sale: s, inscricao: insc, match_rule: rule });
        continue;
      }

      if (rule !== "sale_id" && !insc.greenn_sale_id) {
        divergencias.push({ tipo: "sem_sale_id", sale: s, inscricao: insc, match_rule: rule as "email" | "phone" });
      }

      if (s.valor != null && Math.abs(Number(insc.valor ?? 0) - s.valor) > 0.005) {
        divergencias.push({
          tipo: "valor_diferente",
          sale: s,
          inscricao: insc,
          match_rule: rule,
          diferenca: Number((Number(insc.valor ?? 0) - s.valor).toFixed(2)),
        });
      }

      okPairs.push({ sale: s, inscricao: insc });
    }

    // Inscrições marcadas como pagas no site, mas sem venda correspondente na Greenn
    for (const i of inscricoes ?? []) {
      if (i.status !== "pago") continue;
      if (matchedInscricaoIds.has(i.id)) continue;
      if (i.greenn_sale_id && greenn.some((g) => g.sale_id === String(i.greenn_sale_id))) continue;
      divergencias.push({ tipo: "paga_sem_greenn", inscricao: i });
    }

    const resumo = {
      greenn_total: greenn.length,
      greenn_pagas: greenn.filter((s) => s.is_paid).length,
      site_total: inscricoes?.length ?? 0,
      site_pagas: (inscricoes ?? []).filter((i) => i.status === "pago").length,
      conciliadas: okPairs.length,
      divergencias: divergencias.length,
      por_tipo: divergencias.reduce<Record<string, number>>((acc, d) => {
        acc[d.tipo] = (acc[d.tipo] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return json({ ok: true, gerado_em: new Date().toISOString(), fonte, aviso, resumo, divergencias, greenn, site: inscricoes ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("conciliar-greenn error", msg);
    return json({ ok: false, error: "unhandled", message: msg });
  }
});

async function fetchGreenn(path: string, apiKey: string):
  Promise<{ ok: true; response: Response } | { ok: false; message: string }> {
  const errors: string[] = [];
  for (const base of GREENN_API_CANDIDATES) {
    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(`${base}${path}`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        return { ok: true, response };
      } catch (e) {
        clearTimeout(t);
        errors.push(`${base}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { ok: false, message: errors.join(" | ") };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
