// Webhook público da Cakto.
// Formato: { secret, event, data } — https://cakto-dece4a15.mintlify.app/webhooks/eventos
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Status = "pendente" | "pago" | "recusado" | "reembolsado" | "chargeback";

const EVENT_MAP: Record<string, Status> = {
  purchase_approved: "pago",
  subscription_renewed: "pago",
  purchase_refused: "recusado",
  subscription_canceled: "recusado",
  refund: "reembolsado",
  chargeback: "chargeback",
  pix_gerado: "pendente",
  boleto_gerado: "pendente",
  picpay_gerado: "pendente",
  checkout_abandonment: "pendente",
};

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// Normaliza celular para 13 dígitos (55 + DDD + número).
const normalizePhone = (raw: unknown): string => {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.length === 13 && d.startsWith("55")) return d;
  if (d.length === 11) return `55${d}`;
  if (d.length === 10) return `55${d.slice(0, 2)}9${d.slice(2)}`;
  return d;
};

const timingSafeEqual = (a: string, b: string) => {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expectedSecret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("cakto-webhook: CAKTO_WEBHOOK_SECRET não configurado");
    return json({ error: "server_misconfigured" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const url = new URL(req.url);
  const provided = String(
    body.secret ?? req.headers.get("x-cakto-secret") ?? url.searchParams.get("secret") ?? "",
  ).trim();
  if (!provided || !timingSafeEqual(provided, expectedSecret)) {
    console.warn("cakto-webhook: secret inválido");
    return json({ error: "unauthorized" }, 401);
  }

  const event = String(body.event ?? "").trim();
  const data = (body.data ?? {}) as Record<string, unknown>;
  const status = EVENT_MAP[event];
  if (!status) return json({ ok: true, ignored: true, reason: "evento_desconhecido", event });

  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const nome = String(customer.name ?? "").trim();
  const email = String(customer.email ?? "").toLowerCase().trim();
  const celular = normalizePhone(customer.phone);
  const orderId = String(data.id ?? data.refId ?? "").trim() || null;
  const metodo = String(data.paymentMethod ?? data.payment_method ?? "cakto").trim();
  const valorRaw = Number(data.amount ?? data.baseAmount ?? 0);
  const valor = Number.isFinite(valorRaw) && valorRaw > 0 ? valorRaw : null;
  const pagoEm = status === "pago"
    ? (data.paidAt ? new Date(String(data.paidAt)).toISOString() : new Date().toISOString())
    : null;

  console.log("cakto-webhook:", event, "->", status, orderId, email);

  // Localiza a inscrição: order_id -> email -> celular
  let inscricao: { id: string } | null = null;

  if (orderId) {
    const { data: row } = await supabase
      .from("inscricoes").select("id").eq("cakto_order_id", orderId).maybeSingle();
    if (row) inscricao = row;
  }
  if (!inscricao && email) {
    const { data: row } = await supabase
      .from("inscricoes").select("id").eq("email", email)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (row) inscricao = row;
  }
  if (!inscricao && celular) {
    const { data: row } = await supabase
      .from("inscricoes").select("id").eq("celular", celular)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (row) inscricao = row;
  }

  const patch: Record<string, unknown> = {
    status,
    cakto_payload: body,
    metodo_pagamento: metodo,
  };
  if (orderId) patch.cakto_order_id = orderId;
  if (valor != null) patch.valor = valor;
  if (pagoEm) patch.pago_em = pagoEm;

  if (!inscricao) {
    // Compra feita direto no checkout, sem cadastro prévio no site.
    if (status !== "pago" || !nome) return json({ ok: true, matched: false });

    const { data: inserted, error: insErr } = await supabase.from("inscricoes").insert({
      nome,
      email: email || `sem-email-${orderId ?? crypto.randomUUID()}@magnolias.local`,
      celular: celular || "5500000000000",
      ...patch,
    }).select("id").maybeSingle();

    if (insErr) {
      console.error("cakto-webhook insert error:", insErr);
      return json({ error: "db_insert" }, 500);
    }
    return json({ ok: true, created: true, id: inserted?.id, status });
  }

  const { error: upErr } = await supabase.from("inscricoes").update(patch).eq("id", inscricao.id);
  if (upErr) {
    console.error("cakto-webhook update error:", upErr);
    return json({ error: "db_update" }, 500);
  }

  return json({ ok: true, id: inscricao.id, status });
});
