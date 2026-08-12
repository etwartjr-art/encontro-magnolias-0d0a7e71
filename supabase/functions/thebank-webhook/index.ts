import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-thebank-token, x-thebank-signature",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SECRET = Deno.env.get("THEBANK_WEBHOOK_TOKEN") ?? Deno.env.get("Webhooks_the_bank") ?? "";

// Valor líquido padrão quando o provedor não informa o valor recebido.
const VALOR_LIQUIDO = 41.56;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacHex(secret: string, raw: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Fail-closed: sem segredo configurado o webhook não processa nada.
  if (!SECRET) {
    console.error("THEBANK_WEBHOOK_TOKEN not configured");
    return json({ error: "webhook_not_configured" }, 503);
  }

  const raw = await req.text();

  const url = new URL(req.url);
  const provided =
    req.headers.get("x-thebank-token") ??
    url.searchParams.get("token") ??
    (req.headers.get("Authorization")?.startsWith("Bearer ")
      ? req.headers.get("Authorization")!.slice(7)
      : null);

  const signature = (req.headers.get("x-thebank-signature") ?? "").replace(/^sha256=/, "").toLowerCase();

  let authorized = false;
  if (provided && provided === SECRET) authorized = true;
  if (!authorized && signature) {
    authorized = signature === (await hmacHex(SECRET, raw));
  }

  if (!authorized) {
    console.warn("Rejected unauthenticated The Bank webhook request");
    return json({ error: "unauthorized" }, 401);
  }

  let body: any = null;
  let processedStatus = "success";
  let errorMessage = "";

  try {
    const payload = JSON.parse(raw);
    body = payload;
    console.log("The Bank Webhook received:", JSON.stringify(payload, null, 2));

    const thebankId = payload.id || payload.transaction_id || payload.payment_id;
    const status = (payload.status || payload.payment_status || "").toUpperCase();
    const email = payload.customer?.email?.toLowerCase() || payload.email?.toLowerCase();
    const proofUrl = payload.proof_url || payload.receipt_url || payload.comprovante_url;

    const isPaid = ["PAID", "CONFIRMED", "APPROVED", "SUCCESS", "COMPLETED", "PAGO"].includes(status);

    if (isPaid) {
      if (!email && !thebankId) {
        processedStatus = "error";
        errorMessage = "Missing identifier (email or id)";
      } else {
        const rawNet = payload.net_amount ?? payload.valor_liquido ?? payload.amount_net;
        const net = Number(rawNet);
        const updateData: Record<string, unknown> = {
          status: "pago",
          pago_em: new Date().toISOString(),
          metodo_pagamento: "thebank",
          thebank_id: thebankId,
          thebank_payload: payload,
          comprovante_url: proofUrl,
          valor_liquido: Number.isFinite(net) && net > 0 ? net : VALOR_LIQUIDO,
        };

        let query = supabase.from("inscricoes").update(updateData);

        if (thebankId) {
          query = query.or(`thebank_id.eq.${thebankId},email.eq.${email}`);
        } else {
          query = query.eq("email", email);
        }

        const { data: updated, error } = await query
          .eq("status", "pendente")
          .order("criado_em", { ascending: false })
          .limit(1)
          .select();

        if (error) {
          processedStatus = "error";
          errorMessage = `DB Error: ${error.message}`;
        } else if (!updated || updated.length === 0) {
          processedStatus = "no_match";
          errorMessage = `No pending inscription found for email: ${email} or id: ${thebankId}`;
        }
      }
    } else {
      processedStatus = "ignored";
      errorMessage = `Status ${status} is not considered paid`;
    }

    await supabase.from("thebank_webhook_logs").insert({
      payload: body,
      status_code: 200,
      method: req.method,
      processed_status: processedStatus,
      error_message: errorMessage,
      event_type: payload.event || payload.type || (status ? `payment_${status.toLowerCase()}` : "unknown"),
    });

    return json({ success: true, processedStatus });
  } catch (error) {
    console.error("Webhook error:", error);

    await supabase.from("thebank_webhook_logs").insert({
      payload: body,
      status_code: 400,
      method: req.method,
      processed_status: "error",
      error_message: (error as Error).message,
    });

    return json({ error: "invalid_request" }, 400);
  }
});
