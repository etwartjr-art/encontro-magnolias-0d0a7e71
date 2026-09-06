import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarInscricoes from "./tools/listar-inscricoes";
import resumoInscricoes from "./tools/resumo-inscricoes";
import atualizarStatusInscricao from "./tools/atualizar-status-inscricao";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "site-magnolia",
  title: "Site Magnolia",
  version: "0.1.0",
  instructions:
    "Ferramentas do site do Encontro das Magnólias. Use `listar_inscricoes` para consultar inscrições, `resumo_inscricoes` para totais e receita, e `atualizar_status_inscricao` para confirmar pagamentos.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarInscricoes, resumoInscricoes, atualizarStatusInscricao],
});
