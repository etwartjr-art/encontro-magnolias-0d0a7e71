// Diagnóstico do webhook Greenn: status, últimos logs e disparo de teste.
// Somente admins autenticados podem chamar.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function assertAdmin(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!jwt) return null;
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return null;
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return role ? u.user.id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const userId = await assertAdmin(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: { action?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body.action ?? "status";

  const token = Deno.env.get("GREENN_WEBHOOK_TOKEN") ?? "";
  const webhookUrl = `${SUPABASE_URL}/functions/v1/greenn-webhook`;

  if (action === "status") {
    const { data: logs } = await admin
      .from("greenn_webhook_logs")
      .select("id, greenn_sale_id, status_recebido, status_mapeado, processado, erro, criado_em")
      .order("criado_em", { ascending: false })
      .limit(20);

    const { count: total } = await admin
      .from("greenn_webhook_logs")
      .select("*", { count: "exact", head: true });

    const { count: ultimas24h } = await admin
      .from("greenn_webhook_logs")
      .select("*", { count: "exact", head: true })
      .gte("criado_em", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

    return json({
      ok: true,
      webhook_url: webhookUrl,
      webhook_url_com_token: token ? `${webhookUrl}?token=${encodeURIComponent(token)}` : null,
      token_configurado: Boolean(token),
      token_preview: token ? `${token.slice(0, 4)}…${token.slice(-4)}` : null,
      total_logs: total ?? 0,
      logs_24h: ultimas24h ?? 0,
      ultimos: logs ?? [],
    });
  }

  if (action === "test") {
    if (!token) return json({ error: "GREENN_WEBHOOK_TOKEN não configurado" }, 400);

    const fakeSaleId = `TEST-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    // E-mail e celular únicos por execução para evitar colisão com clientes reais
    // (o webhook faz fallback por email/celular quando não acha o sale_id).
    const uniqueSuffix = fakeSaleId.toLowerCase();
    const testEmail = `teste-webhook+${uniqueSuffix}@magnolias.local`;
    // Celular sintético: prefixo 55119 + 8 dígitos aleatórios (jamais um número real).
    const testCellphone = `55119${Math.floor(10000000 + Math.random() * 89999999)}`;
    const payload = {
      type: "sale",
      event: "saleUpdated",
      currentStatus: "approved",
      sale: {
        id: fakeSaleId,
        status: "approved",
        method: "test",
        amount: 39.9,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      client: {
        name: "Teste Webhook",
        email: testEmail,
        cellphone: testCellphone,
      },
    };

    const url = `${webhookUrl}?token=${encodeURIComponent(token)}`;
    let responseStatus = 0;
    let responseBody: unknown = null;
    let networkError: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "webhook-diag/self-test" },
        body: JSON.stringify(payload),
      });
      responseStatus = res.status;
      const txt = await res.text();
      try { responseBody = JSON.parse(txt); } catch { responseBody = txt; }
    } catch (e) {
      networkError = e instanceof Error ? e.message : String(e);
    }

    // Limpa a inscrição de teste criada (se veio a ser criada). Escopo triplo para nunca
    // remover um registro real: sale_id exclusivo do teste + método "test" + email de teste.
    await admin
      .from("inscricoes")
      .delete()
      .eq("greenn_sale_id", fakeSaleId)
      .eq("metodo_pagamento", "test")
      .eq("email", testEmail);

    return json({
      ok: !networkError && responseStatus >= 200 && responseStatus < 300,
      sent_to: webhookUrl,
      fake_sale_id: fakeSaleId,
      response_status: responseStatus,
      response: responseBody,
      network_error: networkError,
    });
  }

  return json({ error: "ação desconhecida" }, 400);
});
