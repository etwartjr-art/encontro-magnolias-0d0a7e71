import { createClient } from "npm:@supabase/supabase-js@2";

const VALOR_BRUTO = 44.90;
const VALOR_LIQUIDO = 40.61;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Faltando cabeçalho de autorização' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    const { data: { user }, error: userError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));

    if (userError || !user) {
      return json({ error: 'Não autorizado' }, 401);
    }

    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return json({ error: 'Acesso negado' }, 403);
    }

    console.log("Iniciando reconciliação em lote...");

    // 1. Corrigir inscrições pagas com valor líquido zero ou incorreto para o valor padrão de 44.90
    const { data: toUpdate, error: fetchError } = await supabaseClient
      .from('inscricoes')
      .select('id, valor, valor_liquido, status')
      .eq('status', 'pago')
      .eq('valor', VALOR_BRUTO)
      .or(`valor_liquido.is.null,valor_liquido.eq.0,valor_liquido.eq.41.56`);

    if (fetchError) throw fetchError;

    let updatedCount = 0;
    if (toUpdate && toUpdate.length > 0) {
      console.log(`Encontradas ${toUpdate.length} inscrições para atualizar.`);
      
      for (const item of toUpdate) {
        const { error: updateError } = await supabaseClient
          .from('inscricoes')
          .update({ valor_liquido: VALOR_LIQUIDO })
          .eq('id', item.id);
        
        if (!updateError) updatedCount++;
      }
    }

    return json({ 
      message: 'Reconciliação concluída', 
      total_processado: toUpdate?.length || 0,
      total_atualizado: updatedCount 
    });
  } catch (error) {
    console.error("Erro na reconciliação:", error);
    return json({ error: error.message }, 400);
  }
});
