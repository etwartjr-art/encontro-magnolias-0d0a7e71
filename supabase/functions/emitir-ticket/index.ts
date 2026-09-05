// Emite um ticket assinado (HMAC) SOMENTE quando a inscrição está paga.
// Impede que o QR de entrada seja forjado no navegador.
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

const SIGNING_SECRET = Deno.env.get("TICKET_SIGNING_SECRET")!;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SIGNING_SECRET) return json({ error: "server_misconfigured" }, 500);

  let body: { id?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const id = String(body.id ?? "").trim();
  if (!UUID_RE.test(id)) return json({ error: "invalid_id" }, 400);

  const { data, error } = await supabase
    .from("inscricoes")
    .select("id, nome, status, pago_em")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("emitir-ticket db error");
    return json({ error: "db_error" }, 500);
  }
  if (!data) return json({ error: "not_found" }, 404);
  if (data.status !== "pago") return json({ error: "not_paid", status: data.status }, 403);

  // Payload mínimo. Verificação real é feita no check-in usando a assinatura.
  const payload = {
    v: 1,
    id: data.id,
    n: data.nome,
    p: data.pago_em,
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = b64url(new TextEncoder().encode(payloadStr));
  const sig = await hmac(payloadB64);
  const token = `${payloadB64}.${sig}`;

  return json({ token, evento: "Encontro das Magnólias" });
});
