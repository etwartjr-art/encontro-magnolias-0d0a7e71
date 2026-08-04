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

    // A estrutura exata do The Bank pode variar, mas geralmente enviam status e um identificador
    // Aqui assumimos que eles podem enviar o e-mail ou um campo personalizado que passamos
    // No SubscriptionForm.tsx, passamos nome, email e phone.
    
    // De acordo com padrões de mercado, procuramos pelo status 'PAID' ou similar
    const status = payload.status?.toUpperCase();
    const email = payload.customer?.email?.toLowerCase() || payload.email?.toLowerCase();
    
    if (status === "PAID" || status === "CONFIRMED" || status === "APPROVED") {
      if (!email) {
        console.error("Webhook received without email identification");
        return new Response(JSON.stringify({ error: "missing_identifier" }), { status: 400 });
      }

      // Atualiza a inscrição mais recente pendente com esse e-mail
      const { data: updated, error } = await supabase
        .from("inscricoes")
        .update({ 
          status: "pago", 
          pago_em: new Date().toISOString(),
          metodo_pagamento: "thebank"
        })
        .eq("email", email)
        .eq("status", "pendente")
        .order("criado_em", { ascending: false })
        .limit(1)
        .select();

      if (error) {
        console.error("Error updating inscription:", error);
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500 });
      }

      console.log("Inscription updated successfully:", updated);
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
