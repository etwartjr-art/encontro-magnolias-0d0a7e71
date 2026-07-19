import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Scale, Webhook, Copy, Play } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

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

type WebhookLog = {
  id: string;
  greenn_sale_id: string | null;
  status_recebido: string | null;
  status_mapeado: string | null;
  processado: boolean;
  erro: string | null;
  criado_em: string;
};
type WebhookStatus = {
  ok: boolean;
  webhook_url: string;
  webhook_url_com_token: string | null;
  token_configurado: boolean;
  token_preview: string | null;
  total_logs: number;
  logs_24h: number;
  ultimos: WebhookLog[];
};
type ApiTest = {
  ok: boolean;
  base_url?: string;
  test_url?: string;
  response_status?: number;
  response?: unknown;
  network_error?: string | null;
  error_type?: string | null;
  elapsed_ms?: number;
  api_key_preview?: string;
  error?: string;
  message?: string;
};

type WebhookTest = {
  ok: boolean;
  sent_to?: string;
  fake_sale_id?: string;
  response_status?: number;
  response?: unknown;
  network_error?: string | null;
  error?: string;
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
          </div>
        </header>

        <Tabs defaultValue="divergencias" className="w-full">
          <TabsList className="rounded-none bg-ivory border border-rose-dusty/40 mb-6">
            <TabsTrigger value="divergencias" className="rounded-none uppercase tracking-[0.2em] text-xs">
              <Scale className="w-3.5 h-3.5 mr-2" /> Divergências
            </TabsTrigger>
            <TabsTrigger value="webhook" className="rounded-none uppercase tracking-[0.2em] text-xs">
              <Webhook className="w-3.5 h-3.5 mr-2" /> Webhook
            </TabsTrigger>
          </TabsList>

          <TabsContent value="divergencias">
            <div className="flex justify-end mb-4">
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
          </TabsContent>

          <TabsContent value="webhook">
            <WebhookPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

const WebhookPanel = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<WebhookTest | null>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    const { data, error } = await supabase.functions.invoke("webhook-diag", {
      body: { action: "status" },
    });
    if (error) {
      toast({ title: "Erro ao carregar status", description: error.message, variant: "destructive" });
    } else {
      setStatus(data as WebhookStatus);
    }
    setLoadingStatus(false);
  };

  const runTest = async () => {
    setTesting(true);
    setLastTest(null);
    const { data, error } = await supabase.functions.invoke("webhook-diag", {
      body: { action: "test" },
    });
    if (error) {
      toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
    } else {
      const r = data as WebhookTest;
      setLastTest(r);
      toast({
        title: r.ok ? "Webhook respondeu com sucesso" : "Webhook falhou",
        description: r.ok
          ? `HTTP ${r.response_status} — evento de teste processado`
          : r.network_error ?? r.error ?? `HTTP ${r.response_status ?? "?"}`,
        variant: r.ok ? "default" : "destructive",
      });
      await loadStatus();
    }
    setTesting(false);
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado` });
  };

  if (loadingStatus && !status) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-rose-deep" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-ivory border border-rose-dusty/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Configuração no painel Greenn</h2>
          <Badge
            variant={status?.token_configurado ? "default" : "destructive"}
            className="uppercase tracking-wider text-[10px]"
          >
            {status?.token_configurado ? "Token ativo" : "Sem token"}
          </Badge>
        </div>

        <ol className="text-sm text-foreground/80 space-y-1 list-decimal pl-5">
          <li>
            Acesse <span className="font-mono">xgrow-adm.greenn.com.br</span> → Configurações → Webhooks.
          </li>
          <li>Crie um novo webhook para o evento <span className="font-mono">saleUpdated</span> (Venda atualizada).</li>
          <li>Cole a URL abaixo (já inclui o token de autenticação) e salve.</li>
          <li>Use o botão <span className="italic">Disparar teste</span> aqui para validar a ponta a ponta.</li>
        </ol>

        <div className="space-y-3">
          <div>
            <label className="uppercase tracking-[0.2em] text-[10px] text-rose-deep">URL do webhook (com token)</label>
            <div className="flex gap-2 mt-1">
              <Input
                readOnly
                value={status?.webhook_url_com_token ?? status?.webhook_url ?? ""}
                className="rounded-none font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-none shrink-0"
                onClick={() => copy(status?.webhook_url_com_token ?? status?.webhook_url ?? "", "URL")}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {!status?.token_configurado && (
              <p className="text-xs text-destructive mt-1">
                O segredo GREENN_WEBHOOK_TOKEN não está configurado — o webhook rejeitará todas as chamadas.
              </p>
            )}
          </div>

          <div>
            <label className="uppercase tracking-[0.2em] text-[10px] text-rose-deep">Método / Content-Type</label>
            <div className="text-sm font-mono mt-1">POST · application/json</div>
          </div>

          {status?.token_preview && (
            <div>
              <label className="uppercase tracking-[0.2em] text-[10px] text-rose-deep">Token (preview)</label>
              <div className="text-sm font-mono mt-1">{status.token_preview}</div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-ivory border border-rose-dusty/40 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Disparar teste ponta a ponta</h2>
          <Button
            variant="default"
            size="sm"
            onClick={runTest}
            disabled={testing || !status?.token_configurado}
            className="rounded-none uppercase tracking-[0.2em] text-xs"
          >
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Disparar teste
          </Button>
        </div>
        <p className="text-xs text-foreground/70 mb-3">
          Envia um evento fictício <span className="font-mono">saleUpdated</span> ao endpoint do webhook usando o token
          configurado. Registra em <span className="font-mono">greenn_webhook_logs</span> e remove a inscrição de teste
          criada.
        </p>

        {lastTest && (
          <div
            className={`border p-4 text-sm ${
              lastTest.ok
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-900"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2 font-medium mb-1">
              {lastTest.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {lastTest.ok ? "Webhook respondeu com sucesso" : "Falha ao disparar teste"}
            </div>
            <div className="text-xs font-mono whitespace-pre-wrap break-all">
              HTTP {lastTest.response_status ?? "—"}
              {lastTest.network_error ? ` · ${lastTest.network_error}` : ""}
              {"\n"}
              {typeof lastTest.response === "string"
                ? lastTest.response
                : JSON.stringify(lastTest.response, null, 2)}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Últimos eventos recebidos</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {status?.logs_24h ?? 0} nas últimas 24h · {status?.total_logs ?? 0} no total
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStatus}
              disabled={loadingStatus}
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingStatus ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="bg-ivory border border-rose-dusty/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Sale ID</TableHead>
                <TableHead>Status recebido</TableHead>
                <TableHead>Mapeado</TableHead>
                <TableHead>Processado</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(status?.ultimos ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    Nenhum evento recebido ainda. Salve o webhook no painel Greenn e dispare um teste.
                  </TableCell>
                </TableRow>
              ) : (
                (status?.ultimos ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.criado_em).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.greenn_sale_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{log.status_recebido ?? "—"}</TableCell>
                    <TableCell className="text-xs">{log.status_mapeado ?? "—"}</TableCell>
                    <TableCell>
                      {log.processado ? (
                        <Badge variant="default" className="uppercase tracking-wider text-[10px]">Sim</Badge>
                      ) : (
                        <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate" title={log.erro ?? undefined}>
                      {log.erro ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
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
