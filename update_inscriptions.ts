import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const emails = [
  'fatima.reis.lopes@hotmail.com',
  'danielyrasilva@gmail.com',
  'byankafernandes976@gmail.com',
  'priscillafilhadorei@gmail.com',
  'noelia2oliveira@gmail.com',
  'joycergd@gmail.com',
  'cflr23@me.com',
  'modafeminina.lure@gmail.com',
  'izabelcristina046@gmail.com',
  'lopeselena@hotmail.com',
  'lorenabbribeiri@gmail.com',
  'kenia77.gomes@gmail.com',
  'vieiramichelly17@gmail.com'
];

async function updateInscriptions() {
  console.log('Updating inscriptions for emails:', emails);
  
  const { data, error } = await supabase
    .from('inscricoes')
    .update({ 
      status: 'pago', 
      pago_em: new Date().toISOString(),
      metodo_pagamento: 'thebank',
      valor_liquido: 40.61
    })
    .in('email', emails)
    .select();

  if (error) {
    console.error('Error updating:', error);
  } else {
    console.log('Successfully updated:', data?.length, 'records');
  }
}

updateInscriptions();
