// End-to-end: inscrição paga → emitir-ticket → verificar-ticket.
// Cobre também rejeição de ticket adulterado e de inscrição não paga.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE);

async function fn(name: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function createInscricao(status: "pendente" | "pago") {
  const row: Record<string, unknown> = {
    nome: "Teste E2E Magnólia",
    email: `e2e+${crypto.randomUUID()}@example.com`,
    celular: "5562999999999",
    valor: 39.9,
    status,
  };
  if (status === "pago") row.pago_em = new Date().toISOString();
  const { data, error } = await admin.from("inscricoes").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function cleanup(id: string) {
  await admin.from("inscricoes").delete().eq("id", id);
}

Deno.test("paid subscription issues signed QR ticket accepted by verifier", async () => {
  const id = await createInscricao("pago");
  try {
    const emit = await fn("emitir-ticket", { id });
    assertEquals(emit.status, 200);
    const token = emit.json.token as string;
    if (!token || !token.includes(".")) throw new Error("no token");

    const verify = await fn("verificar-ticket", { token });
    assertEquals(verify.status, 200);
    assertEquals(verify.json.valid, true);
    assertEquals(verify.json.id, id);
  } finally {
    await cleanup(id);
  }
});

Deno.test("tampered ticket is rejected", async () => {
  const id = await createInscricao("pago");
  try {
    const emit = await fn("emitir-ticket", { id });
    const token = emit.json.token as string;
    const [payload, sig] = token.split(".");
    // Flip last char of signature.
    const flipped = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A");
    const bad = `${payload}.${flipped}`;

    const verify = await fn("verificar-ticket", { token: bad });
    assertEquals(verify.status, 401);
    assertEquals(verify.json.valid, false);
  } finally {
    await cleanup(id);
  }
});

Deno.test("pending subscription cannot obtain a ticket", async () => {
  const id = await createInscricao("pendente");
  try {
    const emit = await fn("emitir-ticket", { id });
    assertEquals(emit.status, 403);
    assertEquals(emit.json.error, "not_paid");
  } finally {
    await cleanup(id);
  }
});

Deno.test("ticket revoked when payment is reversed", async () => {
  const id = await createInscricao("pago");
  try {
    const emit = await fn("emitir-ticket", { id });
    const token = emit.json.token as string;

    // Simulate refund/chargeback after issuing the ticket.
    await admin.from("inscricoes").update({ status: "reembolsado" }).eq("id", id);

    const verify = await fn("verificar-ticket", { token });
    assertEquals(verify.status, 403);
    assertEquals(verify.json.valid, false);
    assertEquals(verify.json.error, "not_paid");
  } finally {
    await cleanup(id);
  }
});
