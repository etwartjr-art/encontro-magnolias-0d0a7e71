import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  RefreshCw,
  Download,
  Pencil,
  DollarSign,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Webhook,
  UserX,
} from "lucide-react";

type WebhookDiag = {
  ok: boolean;
  endpoint?: string;
  secret_length?: number;
  diagnostico?: string;
  testes: {
    nome: string;
    esperado: number;
    status: number;
    passou: boolean;
    resposta?: string;
    ms?: number;
  }[];
};

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
  
  pago_em: string | null;
  criado_em: string;
  atualizado_em: string;
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
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<WebhookDiag | null>(null);

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("cakto-webhook-test", {
        body: {},
      });
      if (error) throw error;
      setWebhookResult(data as WebhookDiag);
      toast({
        title: (data as WebhookDiag)?.ok ? "Webhook OK" : "Webhook com problema",
        description: (data as WebhookDiag)?.diagnostico ?? "",
        variant: (data as WebhookDiag)?.ok ? undefined : "destructive",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setWebhookResult({ ok: false, diagnostico: message, testes: [] });
      toast({
        title: "Falha ao testar webhook",
        description: message,
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const loadData = async () => {
    const { data, error } = await supabase
      .from("inscricoes")
      .select(
        "id, nome, email, celular, valor, status, metodo_pagamento, pago_em, criado_em, atualizado_em"
      )
      .order("pago_em", { ascending: false, nullsFirst: false });

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
    const receitaLiquida = pagas.reduce((sum, i) => sum + Number(i.valor), 0);
    const receitaBruta = pagas.reduce((sum, i) => {
      const liquido = Number(i.valor);
      const bruto = liquido;
      return sum + bruto;
    }, 0);
    return {
      total: items.length,
      pagas: pagas.length,
      pendentes: items.filter((i) => i.status === "pendente").length,
      receitaBruta,
      receitaLiquida,
    };
  }, [items]);

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
      "Valor Bruto",
      "Valor Líquido",
      "Status",
      "Método",
      "Pago em",
    ];
    const rows = filtered.map((i) => {
      const liquido = Number(i.valor);
      const bruto = liquido;
      return [
        new Date(i.criado_em).toLocaleString("pt-BR"),
        i.nome,
        i.email,
        i.celular,
        bruto.toFixed(2).replace(".", ","),
        liquido.toFixed(2).replace(".", ","),
        i.status,
        i.metodo_pagamento ?? "",
        i.pago_em ? new Date(i.pago_em).toLocaleString("pt-BR") : "",
      ];
    });

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
              asChild
              variant="outline"
              size="sm"
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <Link to="/admin/nao-pagas">
                <UserX className="w-4 h-4 mr-2" /> Não pagas
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
              variant="outline"
              size="sm"
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              {testingWebhook ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Webhook className="w-4 h-4 mr-2" />
              )}
              Testar webhook
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

        {webhookResult && (
          <div
            className={`mb-8 border p-4 ${
              webhookResult.ok
                ? "border-emerald-600/40 bg-emerald-600/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="uppercase tracking-[0.2em] text-xs text-muted-foreground">
                  Diagnóstico do webhook Cakto
                </p>
                <p className="text-sm text-foreground mt-1">
                  {webhookResult.diagnostico}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWebhookResult(null)}
                className="rounded-none text-xs"
              >
                Fechar
              </Button>
            </div>

            {webhookResult.testes.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {webhookResult.testes.map((t) => (
                  <li key={t.nome} className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={t.passou ? "secondary" : "destructive"}
                      className="rounded-none"
                    >
                      {t.status || "erro"}
                    </Badge>
                    <span className="text-foreground">{t.nome}</span>
                    <span className="text-muted-foreground text-xs">
                      esperado {t.esperado}
                      {typeof t.ms === "number" ? ` · ${t.ms}ms` : ""}
                    </span>
                    {t.resposta && (
                      <code className="text-xs text-muted-foreground break-all">
                        {t.resposta}
                      </code>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {webhookResult.endpoint && (
              <p className="mt-3 text-xs text-muted-foreground break-all">
                Endpoint: {webhookResult.endpoint}
                {typeof webhookResult.secret_length === "number"
                  ? ` · secret com ${webhookResult.secret_length} caracteres`
                  : ""}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard icon={Users} label="Inscrições" value={String(stats.total)} />
          <StatCard icon={CheckCircle2} label="Pagas" value={String(stats.pagas)} />
          <StatCard icon={Clock} label="Pendentes" value={String(stats.pendentes)} />
          <StatCard icon={DollarSign} label="Receita Paga (bruto)" value={formatBRL(stats.receitaBruta)} />
          <StatCard icon={DollarSign} label="Receita Recebida (líquido)" value={formatBRL(stats.receitaLiquida)} />
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
                  <TableHead className="whitespace-nowrap">Valor Bruto</TableHead>
                  <TableHead className="whitespace-nowrap">Valor Líquido</TableHead>

                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs text-foreground/70 whitespace-nowrap">
                      {new Date(i.criado_em).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-light">{i.nome}</TableCell>
                    <TableCell className="font-light text-xs">{i.email}</TableCell>
                    <TableCell className="font-mono text-xs">{i.celular}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatBRL(Number(i.valor))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
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
