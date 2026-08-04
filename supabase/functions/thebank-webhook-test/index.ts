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

  const endpoint = `${SUPABASE_URL}/functions/v1/thebank-webhook`;

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

  // 1) Teste de pagamento aprovado (simulado)
  const testePagamento = await call({
    id: "test_" + Math.random().toString(36).slice(2, 9),
    status: "PAID",
    customer: { email: "teste@exemplo.com" },
    event: "payment_confirmed",
    proof_url: "https://example.com/proof.pdf"
  });

  const ok = testePagamento.status === 200;

  return json({
    ok,
    endpoint,
    testes: [
      {
        nome: "Simulação de Pagamento Aprovado",
        esperado: 200,
        status: testePagamento.status,
        passou: ok,
        resposta: testePagamento.body,
        ms: testePagamento.ms,
      }
    ],
    diagnostico: ok
      ? "Endpoint The Bank está respondendo corretamente. O teste enviou um payload simulado e recebeu sucesso."
      : "O endpoint The Bank retornou um erro ao processar o teste simulado. Verifique os logs detalhados.",
  });
});
