import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "resumo_inscricoes",
  title: "Resumo das inscrições",
  description:
    "Retorna totais por status e a receita bruta e líquida das inscrições pagas do Encontro das Magnólias.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("inscricoes")
      .select("status, valor, valor_liquido");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const porStatus: Record<string, number> = {};
    let bruto = 0;
    let liquido = 0;
    for (const row of data ?? []) {
      porStatus[row.status] = (porStatus[row.status] ?? 0) + 1;
      if (row.status === "pago") {
        bruto += Number(row.valor ?? 0);
        liquido += Number(row.valor_liquido ?? 0);
      }
    }
    const resumo = {
      total: data?.length ?? 0,
      por_status: porStatus,
      receita_bruta_pagas: Number(bruto.toFixed(2)),
      receita_liquida_pagas: Number(liquido.toFixed(2)),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(resumo) }],
      structuredContent: resumo,
    };
  },
});
