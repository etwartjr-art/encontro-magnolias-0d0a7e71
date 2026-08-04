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

  try {
    const payload = await req.json();
    console.log("The Bank Webhook received:", JSON.stringify(payload, null, 2));

    // Mapeamento dinâmico baseado no payload do The Bank
    // Geralmente: { id: "...", status: "PAID", customer: { email: "..." }, proof_url: "..." }
    const thebankId = payload.id || payload.transaction_id || payload.payment_id;
    const status = (payload.status || payload.payment_status || "").toUpperCase();
    const email = payload.customer?.email?.toLowerCase() || payload.email?.toLowerCase();
    const proofUrl = payload.proof_url || payload.receipt_url || payload.comprovante_url;
    
    const isPaid = ["PAID", "CONFIRMED", "APPROVED", "SUCCESS", "COMPLETED", "PAGO"].includes(status);

    if (isPaid) {
      if (!email && !thebankId) {
        console.error("Webhook received without identification (email or id)");
        return new Response(JSON.stringify({ error: "missing_identifier" }), { status: 400 });
      }

      // Tenta encontrar por email (pendente) ou por thebankId se já tivermos
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
        console.error("Error updating inscription:", error);
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500 });
      }

      if (!updated || updated.length === 0) {
        console.log("No pending inscription found for:", { email, thebankId });
      } else {
        console.log("Inscription updated successfully:", updated[0].id);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
