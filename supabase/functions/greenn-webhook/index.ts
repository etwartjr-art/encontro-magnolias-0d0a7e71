// Webhook público da Greenn (evento "saleUpdated").
// Localiza a inscrição pelo telefone e atualiza o status.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-greenn-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Aceita status em vários formatos que a Greenn pode enviar.
const STATUS_MAP: Record<string, "pago" | "recusado" | "reembolsado" | "chargeback" | "pendente"> = {
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

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// Vasculha o payload em busca do primeiro campo que se pareça com telefone/status/id.
const pick = (obj: unknown, keys: string[]): unknown => {
  if (!obj || typeof obj !== "object") return undefined;
  const stack: unknown[] = [obj];
  while (stack.length) {
    const cur = stack.pop() as Record<string, unknown>;
    for (const k of Object.keys(cur)) {
      if (keys.includes(k.toLowerCase()) && cur[k] != null && cur[k] !== "") return cur[k];
      if (cur[k] && typeof cur[k] === "object") stack.push(cur[k]);
    }
  }
  return undefined;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("greenn-webhook payload:", JSON.stringify(payload));

  const rawStatus = String(pick(payload, ["status", "sale_status", "payment_status"]) ?? "")
    .toLowerCase()
    .trim();
  const mapped = STATUS_MAP[rawStatus] ?? null;

  const phoneRaw = pick(payload, ["phone", "telephone", "cellphone", "celular", "telefone", "whatsapp"]);
  const phone = digits(phoneRaw).slice(-11);

  const email = String(pick(payload, ["email", "e_mail"]) ?? "").toLowerCase().trim();
  const saleId = String(pick(payload, ["sale_id", "saleid", "id", "order_id", "transaction_id"]) ?? "") || null;

  if (!mapped) {
    console.log("greenn-webhook: status ignorado ->", rawStatus);
    return new Response(JSON.stringify({ ok: true, ignored: true, status: rawStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Match: telefone -> email -> greenn_sale_id (se já preenchido).
  let query = supabase.from("inscricoes").select("id, status").order("created_at", { ascending: false }).limit(1);
  if (phone) query = query.eq("phone", phone);
  else if (email) query = query.eq("email", email);
  else if (saleId) query = query.eq("greenn_sale_id", saleId);
  else {
    return new Response(JSON.stringify({ error: "missing_identifier" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: found, error: selErr } = await query.maybeSingle();
  if (selErr) {
    console.error("greenn-webhook select error:", selErr);
    return new Response(JSON.stringify({ error: "db_select" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!found) {
    console.log("greenn-webhook: inscrição não encontrada", { phone, email, saleId });
    return new Response(JSON.stringify({ ok: true, matched: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const patch: Record<string, unknown> = {
    status: mapped,
    greenn_payload: payload,
  };
  if (saleId) patch.greenn_sale_id = saleId;
  if (mapped === "pago") patch.paid_at = new Date().toISOString();

  const { error: upErr } = await supabase.from("inscricoes").update(patch).eq("id", found.id);
  if (upErr) {
    console.error("greenn-webhook update error:", upErr);
    return new Response(JSON.stringify({ error: "db_update" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: found.id, status: mapped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
