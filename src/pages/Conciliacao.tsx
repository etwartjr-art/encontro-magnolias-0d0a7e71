import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MatchRule = "sale_id" | "email" | "phone";
type GreennSale = {
  sale_id: string;
  status: string;
  is_paid: boolean;
  nome: string;
  email: string;
  celular: string;
  valor: number | null;
  metodo: string | null;
  paid_at: string | null;
};
type Insc = {
  id: string;
  nome: string;
  email: string;
  celular: string;
  valor: number | null;
  status: string;
  metodo_pagamento: string | null;
  greenn_sale_id: string | null;
  pago_em: string | null;
  criado_em: string;
};
type Divergencia =
  | { tipo: "somente_greenn"; sale: GreennSale }
  | { tipo: "status_diferente"; sale: GreennSale; inscricao: Insc; match_rule: MatchRule }
  | { tipo: "valor_diferente"; sale: GreennSale; inscricao: Insc; match_rule: MatchRule; diferenca: number }
  | { tipo: "sem_sale_id"; sale: GreennSale; inscricao: Insc; match_rule: "email" | "phone" }
  | { tipo: "paga_sem_greenn"; inscricao: Insc };

type Resultado = {
  ok: boolean;
  gerado_em?: string;
  fonte?: "api" | "webhook_logs";
  aviso?: string | null;
  resumo?: {
    greenn_total: number;
    greenn_pagas: number;
    site_total: number;
    site_pagas: number;
    conciliadas: number;
    divergencias: number;
    por_tipo: Record<string, number>;
  };
  divergencias?: Divergencia[];
  error?: string;
  message?: string;
};

const formatBRL = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_LABEL: Record<string, { label: string; description: string; variant: "destructive" | "secondary" | "outline" | "default" }> = {
  somente_greenn: {
    label: "Só na Greenn",
    description: "Venda paga na Greenn sem inscrição correspondente no site.",
    variant: "destructive",
  },
  paga_sem_greenn: {
    label: "Paga sem Greenn",
    description: "Inscrição marcada como paga no site, mas não existe venda na Greenn.",
    variant: "destructive",
  },
  status_diferente: {
    label: "Status divergente",
    description: "Venda paga na Greenn, mas a inscrição no site não está paga.",
    variant: "secondary",
  },
  valor_diferente: {
    label: "Valor divergente",
    description: "Valor cobrado na Greenn é diferente do salvo no site.",
    variant: "outline",
  },
  sem_sale_id: {
    label: "Sem sale_id",
    description: "Inscrição casou com uma venda da Greenn mas está sem sale_id salvo.",
    variant: "outline",
  },
};

const Conciliacao = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState<Resultado | null>(null);

  const run = async () => {
    setRunning(true);
    const { data: resp, error } = await supabase.functions.invoke("conciliar-greenn", { method: "POST" });
    if (error) {
      toast({ title: "Erro ao conciliar", description: error.message, variant: "destructive" });
    } else {
      const r = resp as Resultado;
      setData(r);
      if (!r.ok) {
        toast({
          title: "Conciliação não concluída",
          description: r.message ?? r.error ?? "Erro desconhecido",
          variant: "destructive",
        });
      }
    }
    setRunning(false);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate("/auth", { replace: true });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        navigate("/auth", { replace: true });
        return;
      }
      await run();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumo = data?.resumo;
  const divergencias = data?.divergencias ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-rose-deep" strokeWidth={1.2} />
            <div>
              <p className="uppercase tracking-[0.3em] text-xs text-rose-deep">Administração</p>
              <h1 className="font-display text-3xl md:text-4xl text-foreground">Conciliação Greenn × Site</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-none uppercase tracking-[0.2em] text-xs">
              <Link to="/admin">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={run}
              disabled={running}
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
              Recalcular
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-rose-deep" />
          </div>
        ) : !data?.ok ? (
          <div className="border border-destructive/40 bg-destructive/5 p-6">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="font-medium">Não foi possível gerar a conciliação</h2>
            </div>
            <p className="text-sm text-foreground/70">
              {data?.message ?? data?.error ?? "Verifique se a API da Greenn está acessível e tente novamente."}
            </p>
          </div>
        ) : (
          <>
            {data?.aviso && (
              <div className="border border-amber-500/40 bg-amber-50 p-4 mb-6 flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-900">{data.aviso}</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard label={data?.fonte === "webhook_logs" ? "Vendas (webhooks)" : "Vendas Greenn (pagas)"} value={String(resumo?.greenn_pagas ?? 0)} sub={`${resumo?.greenn_total ?? 0} no total`} />
              <StatCard label="Inscrições pagas" value={String(resumo?.site_pagas ?? 0)} sub={`${resumo?.site_total ?? 0} inscrições`} />
              <StatCard label="Conciliadas" value={String(resumo?.conciliadas ?? 0)} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} />
              <StatCard label="Divergências" value={String(resumo?.divergencias ?? 0)} icon={<AlertTriangle className={`w-4 h-4 ${(resumo?.divergencias ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />} />
            </div>

            {divergencias.length === 0 ? (
              <div className="bg-ivory border border-emerald-500/40 p-6 text-center">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
                <p className="font-light text-foreground">
                  Nenhuma divergência encontrada — todas as vendas pagas da Greenn estão refletidas no site.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupBy(divergencias, (d) => d.tipo)).map(([tipo, itens]) => {
                  const meta = TIPO_LABEL[tipo] ?? { label: tipo, description: "", variant: "outline" as const };
                  return (
                    <section key={tipo}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={meta.variant} className="uppercase tracking-wider text-[10px]">
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{itens.length} ocorrência(s)</span>
                      </div>
                      <p className="text-xs text-foreground/70 mb-3">{meta.description}</p>
                      <div className="bg-ivory border border-rose-dusty/40 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>E-mail</TableHead>
                              <TableHead>Celular</TableHead>
                              <TableHead>Greenn</TableHead>
                              <TableHead>Site</TableHead>
                              <TableHead>Sale ID</TableHead>
                              <TableHead>Observação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itens.map((d, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-light">{nomeOf(d)}</TableCell>
                                <TableCell className="text-xs">{emailOf(d)}</TableCell>
                                <TableCell className="font-mono text-xs">{celOf(d)}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {"sale" in d ? (
                                    <div>
                                      <div>{formatBRL(d.sale.valor)}</div>
                                      <div className="text-foreground/50">{d.sale.status}</div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {"inscricao" in d ? (
                                    <div>
                                      <div>{formatBRL(d.inscricao.valor)}</div>
                                      <div className="text-foreground/50">{d.inscricao.status}</div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {"sale" in d ? d.sale.sale_id : d.inscricao.greenn_sale_id ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs text-foreground/70">
                                  {obsOf(d)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {data?.gerado_em && (
              <p className="text-xs text-muted-foreground mt-6">
                Gerado em {new Date(data.gerado_em).toLocaleString("pt-BR")}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
};

const StatCard = ({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) => (
  <div className="bg-ivory border border-rose-dusty/40 p-4">
    <div className="flex items-center justify-between mb-1">
      <p className="uppercase tracking-[0.2em] text-[10px] text-rose-deep">{label}</p>
      {icon}
    </div>
    <p className="font-display text-2xl">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

const nomeOf = (d: Divergencia): string =>
  "inscricao" in d ? d.inscricao.nome : d.sale.nome || "—";
const emailOf = (d: Divergencia): string =>
  "inscricao" in d ? d.inscricao.email : d.sale.email || "—";
const celOf = (d: Divergencia): string =>
  "inscricao" in d ? d.inscricao.celular : d.sale.celular || "—";

const obsOf = (d: Divergencia): string => {
  switch (d.tipo) {
    case "somente_greenn":
      return "Criar inscrição correspondente no site.";
    case "paga_sem_greenn":
      return "Verificar se o pagamento foi feito por fora ou marcar como pendente.";
    case "status_diferente":
      return `Site está "${d.inscricao.status}", Greenn "${d.sale.status}". Reprocessar.`;
    case "valor_diferente":
      return `Diferença de ${formatBRL(d.diferenca)}.`;
    case "sem_sale_id":
      return `Casou por ${d.match_rule}. Salvar sale_id ${d.sale.sale_id}.`;
  }
};

export default Conciliacao;
