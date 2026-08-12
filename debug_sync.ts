
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function checkSync() {
  console.log("Verificando logs de webhook e inscrições pendentes...");
  
  // 1. Verificar logs que falharam por 'no_match'
  const { data: logs } = await supabase
    .from("thebank_webhook_logs")
    .select("*")
    .eq("processed_status", "no_match")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log(`Encontrados ${logs?.length || 0} logs sem correspondência.`);
  
  if (logs && logs.length > 0) {
    for (const log of logs) {
      const email = (log.payload?.customer?.email || log.payload?.email || "").toLowerCase().trim();
      const txId = log.payload?.id || log.payload?.transaction_id;
      
      console.log(`Analisando log: ${log.id} | Email: ${email} | TX: ${txId}`);
      
      // 2. Tentar encontrar a inscrição manualmente
      const { data: inscricoes } = await supabase
        .from("inscricoes")
        .select("*")
        .ilike("email", `%${email}%`);
        
      if (inscricoes && inscricoes.length > 0) {
        console.log(`  -> Encontradas ${inscricoes.length} inscrições possíveis para este e-mail.`);
        inscricoes.forEach(i => {
          console.log(`     ID: ${i.id} | Status: ${i.status} | Email Real: ${i.email}`);
        });
      } else {
        console.log(`  -> Nenhuma inscrição encontrada no banco para o e-mail ${email}`);
      }
    }
  }

  // 3. Verificar se as inscrições pendentes recentes têm algo em comum
  const { data: pendentes } = await supabase
    .from("inscricoes")
    .select("*")
    .eq("status", "pendente")
    .order("criado_em", { ascending: false })
    .limit(10);
    
  console.log("\nInscrições pendentes recentes:");
  pendentes?.forEach(p => {
    console.log(`- ${p.nome} (${p.email}) - Criada em: ${p.criado_em}`);
  });
}

checkSync();
