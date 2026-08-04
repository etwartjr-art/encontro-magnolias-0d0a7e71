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
    const envVars = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY"
    ];

    const results = envVars.map(name => ({
      name,
      configured: !!Deno.env.get(name),
      length: Deno.env.get(name)?.length || 0
    }));

    // Verifica tabelas essenciais
    const { error: dbError } = await supabase.from("inscricoes").select("count").limit(1);
    const { error: logError } = await supabase.from("thebank_webhook_logs").select("count").limit(1);

    const diagnostico = {
      ok: results.every(r => r.name === "THEBANK_WEBHOOK_SECRET" ? true : r.configured) && !dbError && !logError,
      env: results,
      database: {
        inscricoes: !dbError,
        logs: !logError,
        error: dbError?.message || logError?.message || null
      },
      webhook_url: `https://${Deno.env.get("SUPABASE_PROJECT_REF") || "seu-projeto"}.supabase.co/functions/v1/thebank-webhook`
    };

    return new Response(JSON.stringify(diagnostico, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
