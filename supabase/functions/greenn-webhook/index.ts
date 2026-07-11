// Webhook público da Greenn ("saleUpdated").
// 1. Loga o payload cru em greenn_webhook_logs (dedupe por hash).
// 2. Localiza a inscrição por sale_id -> celular -> email.
// 3. Atualiza status, método de pagamento, sale_id e pago_em.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-greenn-signature, x-signature, x-hub-signature-256, x-webhook-signature, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Headers onde a Greenn (ou proxies) podem enviar a assinatura HMAC-SHA256 do body.
const SIGNATURE_HEADERS = [
  "x-greenn-signature",
  "x-signature",
  "x-hub-signature-256",
  "x-webhook-signature",
];

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const norm = b64.trim().replace(/-/g, "+").replace(/_/g, "/");
    const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

// Verifica a assinatura HMAC-SHA256 do corpo cru contra o segredo compartilhado.
// Aceita valores hex, base64 e prefixos comuns ("sha256=..."). Timing-safe.
async function verifySignature(
  rawBody: string,
  provided: string,
  secret: string,
): Promise<boolean> {
  let value = provided.trim();
  if (value.toLowerCase().startsWith("sha256=")) value = value.slice(7).trim();
  if (!value) return false;

  const expected = await hmacSha256(secret, rawBody);

  const asHex = hexToBytes(value);
  if (asHex && timingSafeEqualBytes(asHex, expected)) return true;

  const asB64 = base64ToBytes(value);
  if (asB64 && timingSafeEqualBytes(asB64, expected)) return true;

  return false;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Status = "pago" | "recusado" | "reembolsado" | "chargeback" | "pendente";

const STATUS_MAP: Record<string, Status> = {
  approved: "pago",
  paid: "pago",
  completed: "pago",
  confirmed: "pago",
  refused: "recusado",
  declined: "recusado",
  cancelled: "recusado",
  canceled: "recusado",
  refunded: "reembolsado",
  refund: "reembolsado",
  chargeback: "chargeback",
  chargedback: "chargeback",
  pending: "pendente",
  waiting_payment: "pendente",
};

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// Normaliza celular para 13 dígitos (DDI 55 + DDD + número).
const normalizePhone = (raw: unknown): string => {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.length === 13 && d.startsWith("55")) return d;
  if (d.length === 11) return `55${d}`;                 // sem DDI
  if (d.length === 10) return `55${d.slice(0, 2)}9${d.slice(2)}`; // sem 9
  return d;
};

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

async function sha256(text: string) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    await logIncident("__method_error__", `método ${req.method} não é POST`, { method: req.method });
    return json({ error: "method_not_allowed" }, 405);
  }

  // Segredo compartilhado usado como chave HMAC-SHA256 do corpo da requisição.
  // Fail-closed: sem segredo configurado, nada é processado.
  const secret = Deno.env.get("GREENN_WEBHOOK_TOKEN");
  if (!secret) {
    console.error("greenn-webhook: GREENN_WEBHOOK_TOKEN não configurado — rejeitando requisição");
    await logIncident(
      "__config_error__",
      "GREENN_WEBHOOK_TOKEN não configurado no backend — nenhum evento pode ser processado",
      { user_agent: req.headers.get("user-agent") },
    );
    return json({ error: "server_misconfigured" }, 503);
  }

  // Lê o corpo bruto ANTES de parsear — a assinatura é calculada sobre os bytes originais.
  const rawBody = await req.text();

  // Localiza a assinatura em qualquer um dos headers conhecidos.
  let providedSig = "";
  let sigHeader = "";
  for (const h of SIGNATURE_HEADERS) {
    const v = req.headers.get(h);
    if (v) { providedSig = v; sigHeader = h; break; }
  }

  if (!providedSig) {
    await logIncident("__auth_error__", "Assinatura ausente — configure o header HMAC-SHA256 no webhook da Greenn", {
      user_agent: req.headers.get("user-agent"),
      expected_headers: SIGNATURE_HEADERS,
    });
    return json({ error: "missing_signature" }, 401);
  }

  const valid = await verifySignature(rawBody, providedSig, secret);
  if (!valid) {
    await logIncident("__auth_error__", "Assinatura HMAC-SHA256 inválida — segredo divergente ou body adulterado", {
      user_agent: req.headers.get("user-agent"),
      sig_header: sigHeader,
      sig_preview: `${providedSig.slice(0, 6)}…${providedSig.slice(-4)}`,
    });
    return json({ error: "invalid_signature" }, 401);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await logIncident("__invalid_json__", "Corpo da requisição não é JSON válido", {
      content_type: req.headers.get("content-type"),
    });
    return json({ error: "invalid_json" }, 400);
  }

  console.log("greenn-webhook payload:", JSON.stringify(payload));

  // Processa apenas eventos de venda atualizados
  const eventType = String(pick(payload, ["type"]) ?? "").toLowerCase().trim();
  const eventName = String(pick(payload, ["event"]) ?? "").toLowerCase().trim();
  if (eventType !== "sale" || eventName !== "saleupdated") {
    return json({ ok: true, ignored: true, reason: "evento_nao_sale_updated", eventType, eventName });
  }

  const rawStatus = String(
    pick(payload, ["currentStatus", "current_status", "status", "sale_status", "payment_status"]) ?? "",
  )
    .toLowerCase()
    .trim();
  const statusMapeado = STATUS_MAP[rawStatus] ?? null;
  const saleId =
    (pick(payload, ["sale_id", "saleid", "id", "order_id", "transaction_id"]) as string | number | undefined)
      ?.toString() || null;
  const celular = normalizePhone(pick(payload, ["phone", "telephone", "cellphone", "celular", "telefone", "whatsapp"]));
  const email = String(pick(payload, ["email", "e_mail"]) ?? "").toLowerCase().trim();
  const metodo =
    (pick(payload, ["payment_method", "method", "metodo_pagamento", "paymentmethod"]) as string | undefined) || null;
  const valorRaw = Number(pick(payload, ["net_amount", "amount", "total", "value"]) ?? 0);
  const valorGreenn = valorRaw > 1000 ? valorRaw / 100 : valorRaw;

  // Dedupe: hash de sale_id + status + timestamp opcional
  const event_hash = await sha256(`${saleId ?? "no-id"}|${rawStatus}|${pick(payload, ["updated_at", "date", "created_at"]) ?? ""}`);

  // Insere log (com dedupe via UNIQUE em event_hash)
  const { data: logRow, error: logErr } = await supabase
    .from("greenn_webhook_logs")
    .insert({
      greenn_sale_id: saleId,
      status_recebido: rawStatus,
      status_mapeado: statusMapeado,
      event_hash,
      payload,
    })
    .select("id")
    .single();

  if (logErr) {
    // 23505 = unique_violation -> evento repetido, apenas confirma
    if ((logErr as { code?: string }).code === "23505") {
      console.log("greenn-webhook: evento duplicado ignorado", event_hash);
      return json({ ok: true, duplicated: true });
    }
    console.error("greenn-webhook log error:", logErr);
    return json({ error: "db_log" }, 500);
  }

  if (!statusMapeado) {
    return json({ ok: true, ignored: true, reason: "status_desconhecido", status: rawStatus });
  }

  // Localiza a inscrição: sale_id -> celular -> email
  let inscricao: { id: string } | null = null;

  if (saleId) {
    const { data } = await supabase
      .from("inscricoes").select("id").eq("greenn_sale_id", saleId).maybeSingle();
    if (data) inscricao = data;
  }
  if (!inscricao && celular) {
    const { data } = await supabase
      .from("inscricoes").select("id").eq("celular", celular)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (data) inscricao = data;
  }
  if (!inscricao && email) {
    const { data } = await supabase
      .from("inscricoes").select("id").eq("email", email)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (data) inscricao = data;
  }

  if (!inscricao) {
    await supabase.from("greenn_webhook_logs").update({
      erro: "inscricao_nao_encontrada",
    }).eq("id", logRow.id);
    return json({ ok: true, matched: false });
  }

  const patch: Record<string, unknown> = {
    status: statusMapeado,
    greenn_payload: payload,
  };
  if (saleId) patch.greenn_sale_id = saleId;
  if (metodo) patch.metodo_pagamento = metodo;
  if (isFinite(valorGreenn) && valorGreenn > 0) patch.valor = valorGreenn;
  if (statusMapeado === "pago") patch.pago_em = new Date().toISOString();

  const { error: upErr } = await supabase.from("inscricoes").update(patch).eq("id", inscricao.id);

  if (upErr) {
    console.error("greenn-webhook update error:", upErr);
    await supabase.from("greenn_webhook_logs").update({
      erro: `db_update: ${upErr.message}`,
      inscricao_id: inscricao.id,
    }).eq("id", logRow.id);
    return json({ error: "db_update" }, 500);
  }

  await supabase.from("greenn_webhook_logs").update({
    processado: true,
    inscricao_id: inscricao.id,
  }).eq("id", logRow.id);

  return json({ ok: true, id: inscricao.id, status: statusMapeado });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Registra incidentes (401/config/JSON inválido) no mesmo greenn_webhook_logs.
// Dedupe por bucket de 10 min para não inundar a tabela em caso de webhook mal configurado.
async function logIncident(
  marker: "__auth_error__" | "__config_error__" | "__invalid_json__" | "__method_error__",
  mensagem: string,
  extras: Record<string, unknown> = {},
) {
  try {
    const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
    const event_hash = await sha256(`${marker}|${bucket}`);
    await supabase.from("greenn_webhook_logs").insert({
      status_recebido: marker,
      status_mapeado: null,
      event_hash,
      processado: false,
      erro: mensagem,
      payload: { incident: marker, mensagem, ...extras, at: new Date().toISOString() },
    });
  } catch (e) {
    console.error("greenn-webhook: falha ao registrar incidente", e);
  }
}

