import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "atualizar_status_inscricao",
  title: "Atualizar status da inscrição",
  description:
    "Atualiza o status de pagamento de uma inscrição (por id ou e-mail). Ao marcar como paga, registra a data do pagamento.",
  inputSchema: {
    id: z.string().uuid().optional().describe("Identificador da inscrição."),
    email: z.string().trim().email().optional().describe("E-mail da inscrição, quando o id não for conhecido."),
    status: z
      .enum(["pendente", "pago", "recusado", "reembolsado", "chargeback"])
      .describe("Novo status da inscrição."),
    valor_liquido: z.number().min(0).optional().describe("Valor líquido recebido, se diferente do padrão."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, email, status, valor_liquido }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    if (!id && !email) {
      return { content: [{ type: "text", text: "Informe id ou email." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const patch: Record<string, unknown> = { status };
    if (status === "pago") patch.pago_em = new Date().toISOString();
    if (typeof valor_liquido === "number") patch.valor_liquido = valor_liquido;

    let query = supabase.from("inscricoes").update(patch);
    query = id ? query.eq("id", id) : query.ilike("email", email!);

    const { data, error } = await query.select("id, nome, email, status, valor, valor_liquido, pago_em");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) {
      return { content: [{ type: "text", text: "Nenhuma inscrição encontrada." }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { atualizadas: data.length, inscricoes: data },
    };
  },
});
