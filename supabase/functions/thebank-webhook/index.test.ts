// Teste de integração do webhook The Bank:
// 1) rejeita requisições sem token / com token inválido (fail-closed)
// 2) com token válido, marca a inscrição como paga e grava valor_liquido
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("THEBANK_WEBHOOK_TOKEN") ?? Deno.env.get("Webhooks_the_bank") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE);
const ENDPOINT = `${SUPABASE_URL}/functions/v1/thebank-webhook`;

async function postWebhook(payload: unknown, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ANON}`,
    apikey: ANON,
  };
  if (token !== undefined) headers["x-thebank-token"] = token;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function criarPendente() {
  const email = `webhook-test+${crypto.randomUUID()}@example.com`;
  const { data, error } = await admin
    .from("inscricoes")
    .insert({
      nome: "Teste Webhook The Bank",
      email,
      celular: "5562999990000",
      valor: 44.9,
      valor_liquido: 0,
      status: "pendente",
      metodo_pagamento: "test",
    })
    .select("id, email")
    .single();
  if (error) throw error;
  return data as { id: string; email: string };
}

async function limpar(id: string) {
  await admin.from("inscricoes").delete().eq("id", id);
}

Deno.test("rejeita webhook sem token", async () => {
  const { status } = await postWebhook({ id: "x", status: "PAID" });
  assertEquals(status, 401);
});

Deno.test("rejeita webhook com token inválido", async () => {
  const { status } = await postWebhook({ id: "x", status: "PAID" }, "token-invalido");
  assertEquals(status, 401);
});

Deno.test({
  name: "com token válido marca inscrição como paga com valor_liquido",
  ignore: TOKEN === "",
  fn: async () => {
    const inscricao = await criarPendente();
    try {
      const { status, text } = await postWebhook(
        {
          id: `test_${crypto.randomUUID()}`,
          status: "PAID",
          event: "payment_confirmed",
          customer: { email: inscricao.email },
          net_amount: 41.56,
        },
        TOKEN,
      );
      assertEquals(status, 200, text);
      assert(text.includes("success"), text);

      const { data, error } = await admin
        .from("inscricoes")
        .select("status, valor, valor_liquido, pago_em, metodo_pagamento")
        .eq("id", inscricao.id)
        .single();
      if (error) throw error;

      assertEquals(data!.status, "pago");
      assertEquals(Number(data!.valor_liquido), 41.56);
      assertEquals(data!.metodo_pagamento, "thebank");
      assert(data!.pago_em !== null, "pago_em deve ser preenchido");
    } finally {
      await limpar(inscricao.id);
    }
  },
});
