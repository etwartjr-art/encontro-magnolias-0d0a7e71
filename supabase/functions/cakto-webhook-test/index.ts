// Diagnóstico do endpoint cakto-webhook: dispara duas requisições reais
// (secret inválido e secret válido com evento neutro) e devolve os resultados.
// Não grava nada na tabela de inscrições.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  // Somente administradores autenticados podem rodar o diagnóstico.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const secret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  if (!secret) {
    return json({
      ok: false,
      configured: false,
      message: "CAKTO_WEBHOOK_SECRET não está configurado.",
    });
  }

  const endpoint = `${SUPABASE_URL}/functions/v1/cakto-webhook`;

  const call = async (payload: Record<string, unknown>) => {
    const started = Date.now();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 500), ms: Date.now() - started };
    } catch (e) {
      return { status: 0, body: String(e), ms: Date.now() - started };
    }
  };

  // 1) Secret inválido -> deve retornar 401
  const invalido = await call({
    secret: "secret-invalido-diagnostico",
    event: "diagnostico",
    data: {},
  });

  // 2) Secret válido com evento neutro -> deve retornar 200 e ser ignorado
  const valido = await call({ secret, event: "diagnostico", data: {} });

  const authOk = valido.status === 200;
  const rejectOk = invalido.status === 401;

  return json({
    ok: authOk && rejectOk,
    endpoint,
    secret_length: secret.length,
    testes: [
      {
        nome: "Secret inválido",
        esperado: 401,
        status: invalido.status,
        passou: rejectOk,
        resposta: invalido.body,
        ms: invalido.ms,
      },
      {
        nome: "Secret válido (evento neutro)",
        esperado: 200,
        status: valido.status,
        passou: authOk,
        resposta: valido.body,
        ms: valido.ms,
      },
    ],
    diagnostico: authOk
      ? "Endpoint ativo e o secret salvo aqui é aceito. Se a Cakto ainda receber 401, o valor no painel dela é diferente deste."
      : "O secret salvo aqui não é aceito pelo próprio endpoint — revise o valor de CAKTO_WEBHOOK_SECRET.",
  });
});
