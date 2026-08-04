import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any = null;
  let processedStatus = "success";
  let errorMessage = "";
  
  try {
    const payload = await req.json();
    body = payload;
    console.log("The Bank Webhook received:", JSON.stringify(payload, null, 2));

    const thebankId = payload.id || payload.transaction_id || payload.payment_id;
    const status = (payload.status || payload.payment_status || "").toUpperCase();
    const email = payload.customer?.email?.toLowerCase() || payload.email?.toLowerCase();
    const proofUrl = payload.proof_url || payload.receipt_url || payload.comprovante_url;
    const eventType = payload.event || payload.type || (status ? `payment_${status.toLowerCase()}` : "unknown");
    
    const isPaid = ["PAID", "CONFIRMED", "APPROVED", "SUCCESS", "COMPLETED", "PAGO"].includes(status);

    if (isPaid) {
      if (!email && !thebankId) {
        processedStatus = "error";
        errorMessage = "Missing identifier (email or id)";
      } else {
        let query = supabase.from("inscricoes").update({ 
          status: "pago", 
          pago_em: new Date().toISOString(),
          metodo_pagamento: "thebank",
          thebank_id: thebankId,
          thebank_payload: payload,
          comprovante_url: proofUrl
        });

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
          errorMessage = "No pending inscription found";
        }
      }
    } else {
      processedStatus = "ignored";
      errorMessage = `Status ${status} is not considered paid`;
    }

    // Log the webhook
    await supabase.from("thebank_webhook_logs").insert({
      payload: body,
      status_code: 200,
      method: req.method,
      processed_status: processedStatus,
      error_message: errorMessage,
      event_type: payload.event || payload.type || (status ? `payment_${status.toLowerCase()}` : "unknown")
    });

    return new Response(JSON.stringify({ success: true, processedStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    
    // Log error
    await supabase.from("thebank_webhook_logs").insert({
      payload: body,
      status_code: 400,
      method: req.method,
      processed_status: "error",
      error_message: error.message
    });

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

