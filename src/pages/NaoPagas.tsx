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
  ArrowLeft,
  RefreshCw,
  Download,
  UserX,
  Clock,
  XCircle,
  RotateCcw,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";

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
  
  criado_em: string;
  atualizado_em: string;
};

const NAO_PAGAS: StatusInscricao[] = [
  "pendente",
  "recusado",
  "reembolsado",
  "chargeback",
];

const FILTER_OPTIONS: { value: StatusInscricao | "todos"; label: string }[] = [
  { value: "todos", label: "Todos não pagos" },
  { value: "pendente", label: "Pendente" },
  { value: "recusado", label: "Recusado" },
  { value: "reembolsado", label: "Reembolsado" },
  { value: "chargeback", label: "Chargeback" },
];

const statusVariant = (s: StatusInscricao) => {
  switch (s) {
    case "pendente":
      return "secondary";
    case "recusado":
    case "chargeback":
      return "destructive";
    case "reembolsado":
      return "outline";
    default:
      return "default";
  }
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

const NaoPagas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Inscricao[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusInscricao | "todos">(
    "todos"
  );
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  const loadData = async () => {
    const { data, error } = await supabase
      .from("inscricoes")
      .select(
        "id, nome, email, celular, valor, status, metodo_pagamento, criado_em, atualizado_em"
      )
      .in("status", NAO_PAGAS)
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
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.session.user.id)
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
    const potencial = items.reduce((sum, i) => sum + Number(i.valor || 0), 0);
    return {
      total: items.length,
      pendentes: items.filter((i) => i.status === "pendente").length,
      recusadas: items.filter((i) => i.status === "recusado").length,
      potencial,
    };
  }, [items]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const marcarComoPago = async (id: string) => {
    setSavingStatus(id);
    const pagoEm = new Date().toISOString();
    const { error } = await supabase
      .from("inscricoes")
      .update({ status: "pago", pago_em: pagoEm })
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
    toast({ title: "Inscrição marcada como paga" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const whatsappLink = (i: Inscricao) => {
    const num = onlyDigits(i.celular);
    if (!num) return null;
    const nome = (i.nome || "").split(" ")[0] || "";
    const msg = encodeURIComponent(
      `Olá ${nome}! Vi que você começou sua inscrição no Encontro Magnólias em Chamas mas ainda não finalizou o pagamento. Posso te ajudar a concluir? 💐`
    );
    const prefix = num.length <= 11 ? "55" : "";
    return `https://wa.me/${prefix}${num}?text=${msg}`;
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
    ];
    const rows = filtered.map((i) => [
      new Date(i.criado_em).toLocaleString("pt-BR"),
      i.nome,
      i.email,
      i.celular,
      Number(i.valor).toFixed(2).replace(".", ","),
      i.status,
      i.metodo_pagamento ?? "",
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
    a.download = `nao-pagas-${new Date().toISOString().slice(0, 10)}.csv`;
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
            <UserX className="w-6 h-6 text-rose-deep" strokeWidth={1.2} />
            <div>
              <p className="uppercase tracking-[0.3em] text-xs text-rose-deep">
                Administração
              </p>
              <h1 className="font-display text-3xl md:text-4xl text-foreground">
                Não pagas
              </h1>
              <p className="text-xs text-foreground/60 font-light mt-1">
                Cadastros iniciados que ainda não finalizaram o pagamento.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-none uppercase tracking-[0.2em] text-xs"
            >
              <Link to="/admin">
                <ArrowLeft className="w-4 h-4 mr-2" /> Inscrições
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
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={UserX} label="Total" value={String(stats.total)} />
          <StatCard
            icon={Clock}
            label="Pendentes"
            value={String(stats.pendentes)}
          />
          <StatCard
            icon={XCircle}
            label="Recusadas"
            value={String(stats.recusadas)}
          />
          <StatCard
            icon={RotateCcw}
            label="Potencial"
            value={formatBRL(stats.potencial)}
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
                {FILTER_OPTIONS.map((o) => (
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
            Nenhum cadastro sem pagamento no momento. 🌸
          </p>
        ) : (
          <div className="bg-ivory border border-rose-dusty/40 shadow-petal overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => {
                  const wa = whatsappLink(i);
                  return (
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
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {wa && (
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              className="rounded-none h-8 text-xs"
                              title="Enviar WhatsApp de lembrete"
                            >
                              <a
                                href={wa}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                                WhatsApp
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-none h-8 text-xs text-rose-deep"
                            disabled={savingStatus === i.id}
                            onClick={() => marcarComoPago(i.id)}
                            title="Marcar como pago manualmente"
                          >
                            {savingStatus === i.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Marcar pago
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="px-5 py-3 text-xs text-foreground/50 border-t border-rose-dusty/30">
              Total: {items.length} cadastro(s) sem pagamento
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

export default NaoPagas;
