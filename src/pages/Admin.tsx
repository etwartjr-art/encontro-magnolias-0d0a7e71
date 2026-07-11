import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  LogOut,
  Users,
  FileJson,
  RefreshCw,
  Download,
  Pencil,
  DollarSign,
  Clock,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { Link } from "react-router-dom";


type StatusInscricao =
  | "pendente"
  | "pago"
  | "recusado"
  | "reembolsado"
  | "chargeback";

type Inscricao = {
  id: string;
  nome: string;
  email: string;
  celular: string;
  valor: number;
  status: StatusInscricao;
  metodo_pagamento: string | null;
  greenn_sale_id: string | null;
  greenn_payload: unknown;
  pago_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

type WebhookLog = {
  id: string;
  criado_em: string;
  processado: boolean;
  status_recebido: string | null;
  status_mapeado: StatusInscricao | null;
  greenn_sale_id: string | null;
  erro: string | null;
  payload: unknown;
};

type SyncMatchRule = "sale_id" | "email" | "phone" | "none";

type SyncSnapshot = {
  status?: string | null;
  greenn_sale_id?: string | null;
  pago_em?: string | null;
  metodo_pagamento?: string | null;
};

type SyncBuyer = {
  nome?: string;
  email?: string;
  celular?: string;
};

type SyncDetalhe = {
  saleId?: string;
  acao?: string;
  match_rule?: SyncMatchRule;
  id?: string;
  inscricao?: SyncBuyer;
  buyer?: SyncBuyer;
  antes?: SyncSnapshot;
  depois?: SyncSnapshot;
  tentativa_depois?: SyncSnapshot;
  status_greenn?: string;
  motivo?: string;
  erro?: string;
};


type SyncRun = {
  id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  origem: string;
  sucesso: boolean;
  total: number;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  erros: number;
  erro_mensagem: string | null;
  http_status: number | null;
  detalhes: SyncDetalhe[] | null;
};



const STATUS_OPTIONS: { value: StatusInscricao | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "recusado", label: "Recusado" },
  { value: "reembolsado", label: "Reembolsado" },
  { value: "chargeback", label: "Chargeback" },
];

const EDITABLE_STATUSES: StatusInscricao[] = [
  "pendente",
  "pago",
  "recusado",
  "reembolsado",
  "chargeback",
];

const statusVariant = (s: StatusInscricao) => {
  switch (s) {
    case "pago":
      return "default";
    case "pendente":
      return "secondary";
    case "recusado":
    case "chargeback":
      return "destructive";
    case "reembolsado":
      return "outline";
  }
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Inscricao[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusInscricao | "todos">(
    "todos"
  );
  const [selected, setSelected] = useState<Inscricao | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loadingSync, setLoadingSync] = useState(true);
  const [triggeringSync, setTriggeringSync] = useState(false);

  const loadSyncRuns = async () => {
    const { data, error } = await supabase
      .from("sync_runs" as never)
      .select(
        "id, iniciado_em, finalizado_em, duracao_ms, origem, sucesso, total, criadas, atualizadas, ignoradas, erros, erro_mensagem, http_status, detalhes"
      )
      .order("iniciado_em", { ascending: false })
      .limit(10);
    if (!error) setSyncRuns((data ?? []) as unknown as SyncRun[]);
    setLoadingSync(false);
  };

  const triggerSync = async () => {
    setTriggeringSync(true);
    const { error } = await supabase.functions.invoke("sync-greenn-sales", {
      method: "POST",
    });
    if (error) {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Sincronização executada" });
      await loadData();
    }
    await loadSyncRuns();
    setTriggeringSync(false);
  };

  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const reprocessInscricao = async (inscricaoId: string) => {
    setReprocessing(inscricaoId);
    const { data, error } = await supabase.functions.invoke("reprocess-inscricao", {
      method: "POST",
      body: { inscricaoId },
    });
    if (error) {
      toast({
        title: "Erro ao reprocessar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const acao = (data as { acao?: string; motivo?: string } | null)?.acao;
      const motivo = (data as { motivo?: string } | null)?.motivo;
      toast({
        title: "Reprocessamento concluído",
        description: acao ? `Ação: ${acao}` : motivo ?? "Registrado no histórico.",
      });
      await loadData();
    }
    await loadSyncRuns();
    setReprocessing(null);
  };

  const loadData = async () => {
    const { data, error } = await supabase
      .from("inscricoes")
      .select(
        "id, nome, email, celular, valor, status, metodo_pagamento, greenn_sale_id, greenn_payload, pago_em, criado_em, atualizado_em"
      )
      .order("criado_em", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setItems((data ?? []) as Inscricao[]);
    }
  };


  useEffect(() => {
    let active = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/auth", { replace: true });
        return;
      }
      const userId = sessionData.session.user.id;

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!role) {
        toast({
          title: "Acesso negado",
          description: "Esta conta não é administradora.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth", { replace: true });
        return;
      }

      await Promise.all([loadData(), loadSyncRuns()]);
      if (active) setLoading(false);

    };

    init();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const filtered = useMemo(
    () =>
      statusFilter === "todos"
        ? items
        : items.filter((i) => i.status === statusFilter),
    [items, statusFilter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: items.length };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  const stats = useMemo(() => {
    const pagas = items.filter((i) => i.status === "pago");
    const receita = pagas.reduce((sum, i) => sum + Number(i.valor), 0);
    return {
      total: items.length,
      pagas: pagas.length,
      pendentes: items.filter((i) => i.status === "pendente").length,
      receita,
    };
  }, [items]);

  const openDetails = async (inscricao: Inscricao) => {
    setSelected(inscricao);
    setLogs([]);
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from("greenn_webhook_logs")
      .select(
        "id, criado_em, processado, status_recebido, status_mapeado, greenn_sale_id, erro, payload"
      )
      .eq("inscricao_id", inscricao.id)
      .order("criado_em", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar logs",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLogs((data ?? []) as WebhookLog[]);
    }
    setLoadingLogs(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const updateStatus = async (id: string, novo: StatusInscricao) => {
    setSavingStatus(id);
    const pagoEmNovo =
      novo === "pago" ? new Date().toISOString() : novo === "pendente" ? null : undefined;
    const patch: { status: StatusInscricao; pago_em?: string | null } = { status: novo };
    if (pagoEmNovo !== undefined) patch.pago_em = pagoEmNovo;
    const { error } = await supabase
      .from("inscricoes")
      .update(patch)
      .eq("id", id);
    setSavingStatus(null);
    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Status atualizado" });
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: novo,
              pago_em:
                novo === "pago"
                  ? (patch.pago_em as string)
                  : novo === "pendente"
                  ? null
                  : i.pago_em,
            }
          : i
      )
    );
  };

  const exportCSV = () => {
    const headers = [
      "Data",
      "Nome",
      "Email",
      "Celular",
      "Valor",
      "Status",
      "Método",
      "Pago em",
      "Greenn Sale ID",
    ];
    const rows = filtered.map((i) => [
      new Date(i.criado_em).toLocaleString("pt-BR"),
      i.nome,
      i.email,
      i.celular,
      Number(i.valor).toFixed(2).replace(".", ","),
      i.status,
      i.metodo_pagamento ?? "",
      i.pago_em ? new Date(i.pago_em).toLocaleString("pt-BR") : "",
      i.greenn_sale_id ?? "",
    ]);
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map(csvEscape).join(";"))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscricoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-rose-deep" strokeWidth={1.2} />
            <div>
              <p className="uppercase tracking-[0.3em] text-xs text-rose-deep">
                Administração
              </p>
              <h1 className="font-display text-3xl md:text-4xl text-foreground">
                Inscrições
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao site
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard
            icon={Users}
            label="Inscrições"
            value={String(stats.total)}
          />
          <StatCard
            icon={CheckCircle2}
            label="Pagas"
            value={String(stats.pagas)}
          />
          <StatCard
            icon={Clock}
            label="Pendentes"
            value={String(stats.pendentes)}
          />
          <StatCard
            icon={DollarSign}
            label="Receita (pagas)"
            value={formatBRL(stats.receita)}
          />
        </div>

        <SyncPanel
          runs={syncRuns}
          loading={loadingSync}
          triggering={triggeringSync}
          onTrigger={triggerSync}
          onRefresh={loadSyncRuns}
          onReprocess={reprocessInscricao}
          reprocessingId={reprocessing}
        />




        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="w-56">
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as StatusInscricao | "todos")
              }
            >
              <SelectTrigger className="rounded-none">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}{" "}
                    <span className="text-muted-foreground ml-1">
                      ({counts[o.value] ?? 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Exibindo {filtered.length} de {items.length}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-rose-deep" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-foreground/60 py-20 font-light">
            Nenhuma inscrição para este filtro.
          </p>
        ) : (
          <div className="bg-ivory border border-rose-dusty/40 shadow-petal overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs text-foreground/70 whitespace-nowrap">
                      {new Date(i.criado_em).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-light">{i.nome}</TableCell>
                    <TableCell className="font-light text-xs">
                      {i.email}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {i.celular}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatBRL(Number(i.valor))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={statusVariant(i.status)}
                          className="uppercase tracking-wider text-[10px]"
                        >
                          {i.status}
                        </Badge>
                        <Select
                          value={i.status}
                          onValueChange={(v) =>
                            updateStatus(i.id, v as StatusInscricao)
                          }
                          disabled={savingStatus === i.id}
                        >
                          <SelectTrigger className="rounded-none h-7 w-8 p-0 border-none bg-transparent hover:bg-muted [&>svg:last-child]:hidden justify-center">
                            {savingStatus === i.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {EDITABLE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-foreground/70 whitespace-nowrap">
                      {i.pago_em
                        ? new Date(i.pago_em).toLocaleString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetails(i)}
                        className="rounded-none uppercase tracking-[0.2em] text-[10px]"
                      >
                        <FileJson className="w-3.5 h-3.5 mr-1.5" />
                        Payload
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="px-5 py-3 text-xs text-foreground/50 border-t border-rose-dusty/30">
              Total: {items.length} inscrição(ões)
            </p>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {selected?.nome}
            </DialogTitle>
            <DialogDescription>
              {selected?.email} · {selected?.celular}
              {selected?.greenn_sale_id && (
                <>
                  {" · "}Venda Greenn:{" "}
                  <span className="font-mono">{selected.greenn_sale_id}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-6">
              <section>
                <h3 className="text-xs uppercase tracking-[0.25em] text-rose-deep mb-2">
                  Payload salvo na inscrição
                </h3>
                <pre className="bg-muted p-4 rounded-none text-xs overflow-x-auto max-h-64">
                  {selected.greenn_payload
                    ? JSON.stringify(selected.greenn_payload, null, 2)
                    : "Nenhum payload registrado."}
                </pre>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-[0.25em] text-rose-deep mb-2">
                  Histórico de webhooks ({logs.length})
                </h3>
                {loadingLogs ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-rose-deep" />
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum webhook recebido para esta inscrição.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {logs.map((l) => (
                      <div
                        key={l.id}
                        className="border border-rose-dusty/40 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                          <span className="text-foreground/70">
                            {new Date(l.criado_em).toLocaleString("pt-BR")}
                          </span>
                          {l.status_recebido && (
                            <Badge variant="outline" className="text-[10px]">
                              recebido: {l.status_recebido}
                            </Badge>
                          )}
                          {l.status_mapeado && (
                            <Badge
                              variant={statusVariant(l.status_mapeado)}
                              className="text-[10px] uppercase"
                            >
                              → {l.status_mapeado}
                            </Badge>
                          )}
                          <Badge
                            variant={l.processado ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {l.processado ? "processado" : "não processado"}
                          </Badge>
                          {l.erro && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              erro
                            </Badge>
                          )}
                        </div>
                        {l.erro && (
                          <p className="text-xs text-destructive mb-2">
                            {l.erro}
                          </p>
                        )}
                        <pre className="bg-muted p-3 text-[11px] overflow-x-auto max-h-64">
                          {JSON.stringify(l.payload, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

const formatRelative = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.round(diffMs / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
};

const SyncPanel = ({
  runs,
  loading,
  triggering,
  onTrigger,
  onRefresh,
}: {
  runs: SyncRun[];
  loading: boolean;
  triggering: boolean;
  onTrigger: () => void;
  onRefresh: () => void;
}) => {
  const last = runs[0];
  const successRuns = runs.filter((r) => r.sucesso).length;

  const detalhes: SyncDetalhe[] = Array.isArray(last?.detalhes) ? last!.detalhes! : [];
  const ruleCounts = detalhes.reduce(
    (acc, d) => {
      const r = (d.match_rule ?? "none") as SyncMatchRule;
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    },
    {} as Record<SyncMatchRule, number>
  );
  const ruleLabel: Record<SyncMatchRule, string> = {
    sale_id: "Sale ID",
    email: "E-mail",
    phone: "Telefone",
    none: "Sem match",
  };
  const ruleBadge = (r: SyncMatchRule) => {
    switch (r) {
      case "sale_id":
        return "default" as const;
      case "email":
        return "secondary" as const;
      case "phone":
        return "outline" as const;
      default:
        return "outline" as const;
    }
  };


  return (
    <section className="mb-8 bg-ivory border border-rose-dusty/40 shadow-soft">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-rose-dusty/30">
        <div className="flex items-center gap-2 text-rose-deep">
          <RotateCw className="w-4 h-4" strokeWidth={1.4} />
          <h2 className="uppercase tracking-[0.25em] text-[11px]">
            Sincronização Greenn
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-none uppercase tracking-[0.2em] text-[10px]"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={onTrigger}
            disabled={triggering}
            className="rounded-none uppercase tracking-[0.2em] text-[10px] bg-rose-deep hover:bg-rose-deep/90"
          >
            {triggering ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Sincronizar agora
          </Button>
        </div>
      </header>

      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-rose-deep" />
          </div>
        ) : !last ? (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <AlertTriangle className="w-4 h-4" />
            Nenhuma execução registrada ainda. O cron roda a cada 5 min.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <div>
                <p className="uppercase tracking-[0.2em] text-[10px] text-foreground/60 mb-1">
                  Última execução
                </p>
                <p className="text-sm font-light">
                  {formatRelative(last.iniciado_em)}
                </p>
                <p className="text-[11px] text-foreground/50">
                  {new Date(last.iniciado_em).toLocaleString("pt-BR")}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.2em] text-[10px] text-foreground/60 mb-1">
                  Status
                </p>
                <Badge
                  variant={last.sucesso ? "default" : "destructive"}
                  className="uppercase tracking-wider text-[10px]"
                >
                  {last.sucesso ? "sucesso" : "erro"}
                </Badge>
                {last.http_status != null && (
                  <p className="text-[11px] text-foreground/50 mt-1">
                    HTTP {last.http_status}
                  </p>
                )}
              </div>
              <div>
                <p className="uppercase tracking-[0.2em] text-[10px] text-foreground/60 mb-1">
                  Vendas processadas
                </p>
                <p className="font-display text-2xl">{last.total}</p>
                <p className="text-[11px] text-foreground/50">
                  {last.criadas} criadas · {last.atualizadas} atualizadas
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.2em] text-[10px] text-foreground/60 mb-1">
                  Duração
                </p>
                <p className="text-sm font-light">
                  {last.duracao_ms != null ? `${last.duracao_ms} ms` : "—"}
                </p>
                <p className="text-[11px] text-foreground/50">
                  origem: {last.origem}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.2em] text-[10px] text-foreground/60 mb-1">
                  Últimas 10
                </p>
                <p className="text-sm font-light">
                  {successRuns}/{runs.length} com sucesso
                </p>
              </div>
            </div>

            {last.erro_mensagem && (
              <div className="mb-4 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {last.erro_mensagem}
              </div>
            )}

            <div className="mb-5">
              <p className="uppercase tracking-[0.2em] text-[10px] text-foreground/60 mb-2">
                Como as vendas casaram (última execução)
              </p>
              <div className="flex flex-wrap gap-2">
                {(["sale_id", "email", "phone", "none"] as SyncMatchRule[]).map(
                  (r) => (
                    <Badge
                      key={r}
                      variant={ruleBadge(r)}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {ruleLabel[r]}: {ruleCounts[r] ?? 0}
                    </Badge>
                  )
                )}
              </div>
            </div>

            {detalhes.length > 0 && (
              <details className="text-xs mb-4" open>
                <summary className="cursor-pointer uppercase tracking-[0.2em] text-[10px] text-rose-deep mb-2">
                  Auditoria por inscrição ({detalhes.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {detalhes.map((d, idx) => (
                    <DetalheCard
                      key={idx}
                      d={d}
                      ruleLabel={ruleLabel}
                      ruleBadge={ruleBadge}
                    />
                  ))}
                </div>
              </details>
            )}





            <details className="text-xs">
              <summary className="cursor-pointer uppercase tracking-[0.2em] text-[10px] text-rose-deep mb-2">
                Histórico ({runs.length})
              </summary>
              <div className="mt-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Criadas</TableHead>
                      <TableHead>Atualizadas</TableHead>
                      <TableHead>Ignoradas</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-[11px]">
                          {new Date(r.iniciado_em).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-[11px]">{r.origem}</TableCell>
                        <TableCell>
                          <Badge
                            variant={r.sucesso ? "default" : "destructive"}
                            className="text-[10px] uppercase"
                          >
                            {r.sucesso ? "ok" : "erro"}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.total}</TableCell>
                        <TableCell>{r.criadas}</TableCell>
                        <TableCell>{r.atualizadas}</TableCell>
                        <TableCell>{r.ignoradas}</TableCell>
                        <TableCell>{r.erros}</TableCell>
                        <TableCell className="text-[11px]">
                          {r.duracao_ms != null ? `${r.duracao_ms}ms` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
};

const actionBadgeVariant = (acao?: string) => {
  if (!acao) return "outline" as const;
  if (acao.startsWith("erro")) return "destructive" as const;
  if (acao === "criada") return "default" as const;
  if (acao === "atualizada") return "default" as const;
  if (acao.startsWith("ignorada")) return "secondary" as const;
  return "outline" as const;
};

const fmtSnapVal = (k: string, v: unknown) => {
  if (v == null || v === "") return "—";
  if (k === "pago_em" && typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleString("pt-BR");
  }
  return String(v);
};

const SNAP_FIELDS: { key: keyof SyncSnapshot; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "greenn_sale_id", label: "Sale ID" },
  { key: "pago_em", label: "Pago em" },
  { key: "metodo_pagamento", label: "Método" },
];

const DetalheCard = ({
  d,
  ruleLabel,
  ruleBadge,
}: {
  d: SyncDetalhe;
  ruleLabel: Record<SyncMatchRule, string>;
  ruleBadge: (r: SyncMatchRule) => "default" | "secondary" | "outline" | "destructive";
}) => {
  const rule = (d.match_rule ?? "none") as SyncMatchRule;
  const insc = d.inscricao;
  const buyer = d.buyer;
  const antes = d.antes;
  const depois = d.depois ?? d.tentativa_depois;
  const changedKeys = new Set<string>();
  if (antes && depois) {
    for (const f of SNAP_FIELDS) {
      if ((antes[f.key] ?? null) !== (depois[f.key] ?? null)) changedKeys.add(f.key as string);
    }
  }

  return (
    <div className="border border-rose-dusty/40 bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge variant={actionBadgeVariant(d.acao)} className="text-[10px] uppercase tracking-wider">
          {d.acao ?? "—"}
        </Badge>
        <Badge variant={ruleBadge(rule)} className="text-[10px] uppercase">
          match: {ruleLabel[rule]}
        </Badge>
        {d.saleId && (
          <span className="text-[11px] text-foreground/60">
            sale <span className="font-mono">{d.saleId}</span>
          </span>
        )}
        {d.id && (
          <span className="text-[11px] text-foreground/50">
            inscrição <span className="font-mono">{d.id.slice(0, 8)}</span>
          </span>
        )}
      </div>

      {(insc || buyer) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] mb-2">
          {insc && (
            <div>
              <p className="uppercase tracking-[0.18em] text-[9px] text-foreground/50 mb-0.5">
                Inscrição no site
              </p>
              <p className="font-light">{insc.nome ?? "—"}</p>
              <p className="text-foreground/60">
                {insc.email ?? "—"} · {insc.celular ?? "—"}
              </p>
            </div>
          )}
          {buyer && (
            <div>
              <p className="uppercase tracking-[0.18em] text-[9px] text-foreground/50 mb-0.5">
                Comprador na Greenn
              </p>
              <p className="font-light">{buyer.nome || "—"}</p>
              <p className="text-foreground/60">
                {buyer.email || "—"} · {buyer.celular || "—"}
              </p>
            </div>
          )}
        </div>
      )}

      {antes && depois && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-foreground/50 uppercase tracking-[0.18em] text-[9px]">
                <th className="py-1 pr-2 font-normal">Campo</th>
                <th className="py-1 pr-2 font-normal">Antes</th>
                <th className="py-1 font-normal">Depois</th>
              </tr>
            </thead>
            <tbody>
              {SNAP_FIELDS.map((f) => {
                const changed = changedKeys.has(f.key as string);
                return (
                  <tr key={f.key as string} className="border-t border-rose-dusty/20">
                    <td className="py-1 pr-2 text-foreground/60">{f.label}</td>
                    <td className={`py-1 pr-2 font-mono ${changed ? "text-foreground/60 line-through" : "text-foreground/70"}`}>
                      {fmtSnapVal(f.key as string, antes[f.key])}
                    </td>
                    <td className={`py-1 font-mono ${changed ? "text-rose-deep" : "text-foreground/70"}`}>
                      {fmtSnapVal(f.key as string, depois[f.key])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!antes && depois && (
        <div className="text-[11px] text-foreground/70">
          <span className="uppercase tracking-[0.18em] text-[9px] text-foreground/50 mr-1">
            Criada como:
          </span>
          status <span className="font-mono">{depois.status ?? "—"}</span>
          {" · "}sale <span className="font-mono">{depois.greenn_sale_id ?? "—"}</span>
        </div>
      )}

      {d.status_greenn && (
        <p className="text-[11px] text-foreground/60 mt-2">
          status recebido da Greenn: <span className="font-mono">{d.status_greenn}</span>
        </p>
      )}
      {d.motivo && (
        <p className="text-[11px] text-foreground/60 mt-1">Motivo: {d.motivo}</p>
      )}
      {d.erro && (
        <p className="text-[11px] text-destructive mt-1">Erro: {d.erro}</p>
      )}
    </div>
  );
};

const StatCard = ({


  icon: Icon,
  label,
  value,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: string;
}) => (
  <div className="bg-ivory border border-rose-dusty/40 p-4 shadow-soft">
    <div className="flex items-center gap-2 mb-2 text-rose-deep">
      <Icon className="w-4 h-4" strokeWidth={1.4} />
      <p className="uppercase tracking-[0.2em] text-[10px]">{label}</p>
    </div>
    <p className="font-display text-2xl md:text-3xl text-foreground">{value}</p>
  </div>
);

export default Admin;
