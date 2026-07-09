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
import { Loader2, LogOut, Users, FileJson, RefreshCw } from "lucide-react";

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

const STATUS_OPTIONS: { value: StatusInscricao | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "recusado", label: "Recusado" },
  { value: "reembolsado", label: "Reembolsado" },
  { value: "chargeback", label: "Chargeback" },
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
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </header>

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
                      <Badge
                        variant={statusVariant(i.status)}
                        className="uppercase tracking-wider text-[10px]"
                      >
                        {i.status}
                      </Badge>
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

export default Admin;
