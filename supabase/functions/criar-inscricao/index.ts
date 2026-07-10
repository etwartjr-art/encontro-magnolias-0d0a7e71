// Cria uma inscrição pendente e retorna os dados básicos.
// Usa service role para contornar a ausência de policy SELECT para anon
// (RLS aplica ao RETURNING do INSERT via PostgREST).
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

const PHONE_RE = /^55\d{10,11}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALOR = 39.9;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { nome?: string; email?: string; celular?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const nome = String(body.nome ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const celular = String(body.celular ?? "").trim();

  if (nome.length < 2 || nome.length > 120) return json({ error: "invalid_nome" }, 400);
  if (!EMAIL_RE.test(email) || email.length > 255) return json({ error: "invalid_email" }, 400);
  if (!PHONE_RE.test(celular)) return json({ error: "invalid_celular" }, 400);

  const { data, error } = await supabase
    .from("inscricoes")
    .insert({ nome, email, celular, valor: VALOR })
    .select("id, nome, email, celular")
    .single();

  if (error || !data) {
    console.error("criar-inscricao error:", error);
    return json({ error: "db_error" }, 500);
  }
  return json(data);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
