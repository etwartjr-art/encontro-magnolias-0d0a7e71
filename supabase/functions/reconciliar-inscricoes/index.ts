import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-client@2.45.1"

const VALOR_BRUTO = 44.90;
const VALOR_LIQUIDO = 40.61;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar se é admin
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    ).auth.getUser(authHeader.replace('Bearer ', ''))

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    console.log("Iniciando reconciliação em lote...");

    // 1. Corrigir inscrições pagas com valor líquido zero ou incorreto para o valor padrão de 44.90
    const { data: toUpdate, error: fetchError } = await supabaseClient
      .from('inscricoes')
      .select('id, valor, valor_liquido, status')
      .eq('status', 'pago')
      .or(`valor_liquido.is.null,valor_liquido.eq.0,valor_liquido.eq.41.56`)

    if (fetchError) throw fetchError;

    let updatedCount = 0;
    if (toUpdate && toUpdate.length > 0) {
      console.log(`Encontradas ${toUpdate.length} inscrições para atualizar.`);
      
      for (const item of toUpdate) {
        // Se o valor for o padrão (44.90), atualizamos para o novo líquido padrão (40.61)
        if (Number(item.valor) === VALOR_BRUTO) {
          const { error: updateError } = await supabaseClient
            .from('inscricoes')
            .update({ valor_liquido: VALOR_LIQUIDO })
            .eq('id', item.id);
          
          if (!updateError) updatedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Reconciliação concluída', 
        total_processado: toUpdate?.length || 0,
        total_atualizado: updatedCount 
      }),
      {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Erro na reconciliação:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
