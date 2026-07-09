// Verifica o ticket assinado apresentado no check-in.
// Confere assinatura HMAC-SHA256 e reconfirma status='pago' no banco.
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

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ valid: false, error: "method_not_allowed" }, 405);
  if (!SIGNING_SECRET) return json({ valid: false, error: "server_misconfigured" }, 500);

  let body: { token?: string } = {};
  try { body = await req.json(); } catch { return json({ valid: false, error: "invalid_json" }, 400); }

  const token = String(body.token ?? "").trim();
  const parts = token.split(".");
  if (parts.length !== 2) return json({ valid: false, error: "malformed_token" }, 400);

  const [payloadB64, sig] = parts;
  const expected = await hmac(payloadB64);
  if (!timingSafeEqual(sig, expected)) {
    return json({ valid: false, error: "bad_signature" }, 401);
  }

  let payload: { v?: number; id?: string; n?: string; p?: string; iat?: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return json({ valid: false, error: "bad_payload" }, 400);
  }

  if (payload.v !== 1 || !payload.id) return json({ valid: false, error: "bad_payload" }, 400);

  const { data, error } = await supabase
    .from("inscricoes")
    .select("id, nome, status, pago_em")
    .eq("id", payload.id)
    .maybeSingle();

  if (error) return json({ valid: false, error: "db_error" }, 500);
  if (!data) return json({ valid: false, error: "not_found" }, 404);
  if (data.status !== "pago") return json({ valid: false, error: "not_paid", status: data.status }, 403);

  return json({ valid: true, id: data.id, nome: data.nome, pago_em: data.pago_em });
});
