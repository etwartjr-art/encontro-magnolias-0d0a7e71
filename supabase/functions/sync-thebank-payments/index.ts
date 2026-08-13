import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const THEBANK_API_KEY = Deno.env.get("THEBANK_API_KEY"); // O usuário precisará configurar esta secret
const VALOR_LIQUIDO_PADRAO = 40.61;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // Apenas chamadas autenticadas via CRON ou manualmente com service role
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
     // Se for do PG_CRON, ele pode passar o segredo via query param se configurado, 
     // mas aqui vamos simplificar para service_role ou verificar um segredo específico.
     const url = new URL(req.url);
     const cronSecret = Deno.env.get("SYNC_CRON_SECRET");
     if (!cronSecret || url.searchParams.get("secret") !== cronSecret) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
     }
  }

  if (!THEBANK_API_KEY) {
    console.error("THEBANK_API_KEY not configured");
    return new Response(JSON.stringify({ error: "The Bank API Key missing" }), { status: 500 });
  }

  try {
    // 1. Buscar inscrições pendentes
    const { data: pendentes, error: fetchError } = await supabase
      .from("inscricoes")
      .select("*")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false })
      .limit(50);

    if (fetchError) throw fetchError;
    if (!pendentes || pendentes.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma inscrição pendente para sincronizar" }), { status: 200 });
    }

    let atualizados = 0;
    const logs = [];

    for (const inscricao of pendentes) {
      try {
        // 2. Consultar status no The Bank via API
        // Nota: O endpoint exato depende da documentação do The Bank. 
        // Geralmente é algo como GET /v1/transactions?email=... ou similar.
        // Como não temos a doc completa, vamos implementar uma busca por email/identificador.
        
        const response = await fetch(`https://api.thebank.com.br/v1/transactions?email=${encodeURIComponent(inscricao.email)}`, {
          headers: {
            "Authorization": `Bearer ${THEBANK_API_KEY}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
           console.error(`Erro ao consultar The Bank para ${inscricao.email}: ${response.status}`);
           continue;
        }

        const data = await response.json();
        const transacoes = data.data || data; // Ajustar conforme formato real

        // Procurar transação paga correspondente
        const paga = Array.isArray(transacoes) ? transacoes.find((t: any) => 
          ["PAID", "CONFIRMED", "APPROVED", "SUCCESS", "COMPLETED", "PAGO"].includes((t.status || "").toUpperCase()) &&
          Number(t.amount) >= Number(inscricao.valor)
        ) : null;

        if (paga) {
          const netAmount = paga.net_amount ?? paga.valor_liquido ?? paga.amount_net;
          const net = Number(netAmount);

          const { error: updateError } = await supabase
            .from("inscricoes")
            .update({
              status: "pago",
              pago_em: paga.paid_at || new Date().toISOString(),
              metodo_pagamento: "thebank_sync",
              thebank_id: paga.id || paga.transaction_id,
              thebank_payload: paga,
              valor_liquido: Number.isFinite(net) && net > 0 ? net : VALOR_LIQUIDO_PADRAO,
            })
            .eq("id", inscricao.id);

          if (!updateError) {
            atualizados++;
            logs.push({ email: inscricao.email, status: "pago" });
          }
        }
      } catch (e) {
        console.error(`Erro processando ${inscricao.email}:`, e);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processados: pendentes.length, 
      atualizados,
      logs
    }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
