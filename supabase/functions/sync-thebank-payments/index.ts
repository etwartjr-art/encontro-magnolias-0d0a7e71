import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const THEBANK_API_KEY = Deno.env.get("THEBANK_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("SYNC_CRON_SECRET") ?? "";
const VALOR_LIQUIDO_PADRAO = 40.61;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PAID = ["PAID", "CONFIRMED", "APPROVED", "SUCCESS", "COMPLETED", "PAGO", "PAGA"];

// Endpoints candidatos da plataforma (a API do The Bank não é pública/documentada).
// /v1/sales responde 401 sem credencial (existe); os demais respondem 404.
const ENDPOINTS = [
  "https://api.thebank.com.br/v1/sales",
  "https://api.thebank.com.br/v1/transactions",
  "https://api.thebank.com.br/api/v1/transactions",
];

// A plataforma pode esperar a chave em formatos diferentes; tentamos todos.
const AUTH_VARIANTS: { nome: string; headers: Record<string, string> }[] = [
  { nome: "bearer", headers: { Authorization: `Bearer ${THEBANK_API_KEY}` } },
  { nome: "x-api-key", headers: { "x-api-key": THEBANK_API_KEY } },
  { nome: "api-key", headers: { "api-key": THEBANK_API_KEY } },
  { nome: "authorization-raw", headers: { Authorization: THEBANK_API_KEY } },
];

async function isAdminRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (token === SERVICE_ROLE) return true;

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  // Chamada interna (cron) com chave de serviço válida, ainda que diferente da env atual:
  // uma chave de serviço consegue ler uma tabela protegida por RLS; anon/usuário não.
  try {
    const svcProbe = createClient(SUPABASE_URL, token);
    const { error: probeErr } = await svcProbe
      .from("thebank_webhook_logs")
      .select("id")
      .limit(1);
    if (!probeErr) return true;
  } catch (_e) { /* segue para validação de usuário */ }

  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return false;
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  return !!isAdmin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const viaCron = !!CRON_SECRET && url.searchParams.get("secret") === CRON_SECRET;

  if (!viaCron && !(await isAdminRequest(req))) {
    return json({ error: "unauthorized" }, 401);
  }

  const diagnostico: Record<string, unknown> = {};

  if (!THEBANK_API_KEY) {
    return json({
      ok: false,
      diagnostico:
        "A chave da API da plataforma (THEBANK_API_KEY) não está configurada. Sem ela só o webhook consegue atualizar pagamentos.",
      atualizados: 0,
    });
  }

  // 1) Inscrições pendentes
  const { data: pendentes, error: fetchError } = await admin
    .from("inscricoes")
    .select("id, nome, email, valor, criado_em")
    .eq("status", "pendente")
    .order("criado_em", { ascending: false })
    .limit(100);

  if (fetchError) return json({ ok: false, erro: fetchError.message }, 500);
  if (!pendentes?.length) {
    return json({ ok: true, atualizados: 0, diagnostico: "Nenhuma inscrição pendente." });
  }

  // 2) Descobre qual endpoint + formato de autenticação respondem com a chave configurada
  let endpointOk: string | null = null;
  let authOk: Record<string, string> | null = null;
  const tentativas: { endpoint: string; auth: string; status: number; corpo: string }[] = [];

  for (const base of ENDPOINTS) {
    for (const variante of AUTH_VARIANTS) {
      try {
        const res = await fetch(base, {
          headers: { ...variante.headers, "Content-Type": "application/json" },
        });
        const corpo = (await res.text()).slice(0, 300);
        tentativas.push({ endpoint: base, auth: variante.nome, status: res.status, corpo });
        if (res.ok) {
          endpointOk = base;
          authOk = variante.headers;
          break;
        }
      } catch (e) {
        tentativas.push({
          endpoint: base,
          auth: variante.nome,
          status: 0,
          corpo: String(e).slice(0, 200),
        });
      }
      // 404 = caminho inexistente: não adianta tentar outros formatos de auth
      if (tentativas[tentativas.length - 1]?.status === 404) break;
    }
    if (endpointOk) break;
  }
  diagnostico.tentativas = tentativas;

  if (!endpointOk || !authOk) {
    const chaveRejeitada = tentativas.some((t) => t.status === 401 || t.status === 403);
    return json({
      ok: false,
      atualizados: 0,
      pendentes: pendentes.length,
      motivo: chaveRejeitada ? "chave_rejeitada" : "endpoint_indisponivel",
      diagnostico: chaveRejeitada
        ? "A plataforma respondeu, mas recusou a chave de API configurada (401). Gere uma nova chave de API no painel do The Bank e atualize o segredo THEBANK_API_KEY. Enquanto isso, o webhook continua sendo a via automática de atualização."
        : "A API da plataforma não respondeu em nenhum endereço conhecido. O webhook continua sendo a via automática de atualização — confirme o cadastro da URL do webhook no painel do The Bank.",
      detalhes: diagnostico,
    });
  }

  // 3) Consulta cada pendente e atualiza os pagos
  let atualizados = 0;
  const resultados: unknown[] = [];

  for (const inscricao of pendentes) {
    try {
      const res = await fetch(
        `${endpointOk}?email=${encodeURIComponent(inscricao.email)}`,
        {
          headers: { ...authOk, "Content-Type": "application/json" },
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const lista = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
      const paga = Array.isArray(lista)
        ? lista.find((t: Record<string, unknown>) =>
            PAID.includes(String(t.status ?? t.payment_status ?? "").toUpperCase()),
          )
        : null;

      if (!paga) continue;

      const net = Number(paga.net_amount ?? paga.valor_liquido ?? paga.amount_net);
      const { error: updErr } = await admin
        .from("inscricoes")
        .update({
          status: "pago",
          pago_em: paga.paid_at ?? new Date().toISOString(),
          metodo_pagamento: "thebank",
          thebank_id: paga.id ?? paga.transaction_id ?? null,
          thebank_payload: paga,
          valor_liquido: Number.isFinite(net) && net > 0 ? net : VALOR_LIQUIDO_PADRAO,
        })
        .eq("id", inscricao.id);

      if (!updErr) {
        atualizados++;
        resultados.push({ email: inscricao.email, status: "pago" });
      }
    } catch (e) {
      console.error("Erro sincronizando", inscricao.email, e);
    }
  }

  return json({
    ok: true,
    endpoint: endpointOk,
    processados: pendentes.length,
    atualizados,
    resultados,
    diagnostico: `${atualizados} de ${pendentes.length} inscrições pendentes foram confirmadas como pagas.`,
  });
});
