// Consulta pública de status de uma inscrição específica por id.
// Usa service role no servidor para evitar expor SECURITY DEFINER ao anon.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { id?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const id = String(body.id ?? "").trim();
  if (!UUID_RE.test(id)) return json({ error: "invalid_id" }, 400);

  const { data, error } = await supabase
    .from("inscricoes")
    .select("status, nome, pago_em")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("verificar-status error:", error);
    return json({ error: "db_error" }, 500);
  }
  if (!data) return json({ found: false });
  return json({ found: true, ...data });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
