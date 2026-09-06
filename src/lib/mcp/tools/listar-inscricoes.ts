import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_inscricoes",
  title: "Listar inscrições",
  description:
    "Lista as inscrições do Encontro das Magnólias, com filtro opcional por status ou por busca em nome/e-mail.",
  inputSchema: {
    status: z
      .enum(["pendente", "pago", "recusado", "reembolsado", "chargeback"])
      .optional()
      .describe("Filtra pelo status da inscrição."),
    busca: z.string().trim().min(1).optional().describe("Texto para buscar em nome ou e-mail."),
    limite: z.number().int().min(1).max(200).default(50).describe("Máximo de registros retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("inscricoes")
      .select("id, nome, email, celular, status, valor, valor_liquido, criado_em, pago_em")
      .order("criado_em", { ascending: false })
      .limit(limite ?? 50);

    if (status) query = query.eq("status", status);
    if (busca) query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { total: data?.length ?? 0, inscricoes: data ?? [] },
    };
  },
});
