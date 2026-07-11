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
        "id, iniciado_em, finalizado_em, duracao_ms, origem, sucesso, total, criadas, atualizadas, ignoradas, erros, erro_mensagem, http_status"
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

      await loadData();
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
