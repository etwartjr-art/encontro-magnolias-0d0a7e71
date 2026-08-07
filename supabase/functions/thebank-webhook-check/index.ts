import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const supabase = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Somente administradores autenticados podem ver o diagnóstico.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  try {
    const envVars = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "THEBANK_WEBHOOK_TOKEN",
    ];

    const results = envVars.map((name) => ({
      name,
      configured: !!(Deno.env.get(name) ?? (name === "THEBANK_WEBHOOK_TOKEN" ? Deno.env.get("Webhooks_the_bank") : undefined)),
    }));

    const { error: dbError } = await supabase.from("inscricoes").select("count").limit(1);
    const { error: logError } = await supabase.from("thebank_webhook_logs").select("count").limit(1);

    return json({
      ok: results.every((r) => r.configured) && !dbError && !logError,
      env: results,
      database: {
        inscricoes: !dbError,
        logs: !logError,
        error: dbError?.message || logError?.message || null,
      },
      webhook_url: `${SUPABASE_URL}/functions/v1/thebank-webhook`,
    });
  } catch (_error) {
    return json({ error: "internal_error" }, 500);
  }
});
