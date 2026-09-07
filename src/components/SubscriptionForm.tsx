import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";

// URL do checkout (plataforma de pagamento). Atualize aqui ao trocar de plataforma.
const PAYMENT_BASE_URL = "https://checkout.thebank.com.br/7502169602555367424";
const STORAGE_KEY = "magnolias.inscricao.id";
const VALOR = 44.9;

const subscriptionSchema = z.object({
  nome: z.string().trim().min(2, { message: "Informe seu nome completo" }).max(120, { message: "Nome muito longo" }),
  email: z.string().trim().email({ message: "Informe um e-mail válido" }).max(255),
  celular: z
    .string()
    .trim()
    .regex(/^\(\d{2}\) \d{5}-\d{4}$/, { message: "Informe um celular válido (00) 00000-0000" }),
});

type StatusValue = "pendente" | "pago" | "recusado" | "reembolsado" | "chargeback";

type SuccessData = {
  id: string;
  nome: string;
  email: string;
  celular: string; // 13 dígitos com DDI 55
};

const formatPhoneMask = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length < 3) return `(${d}`;
  if (d.length < 8) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

// Retorna 13 dígitos: 55 + DDD + número.
const toE164Digits = (masked: string) => {
  const d = masked.replace(/\D/g, "");
  return `55${d}`;
};

const buildCheckoutUrl = (nome: string, email: string, celular13: string) => {
  const url = new URL(PAYMENT_BASE_URL);
  url.searchParams.set("name", nome);
  url.searchParams.set("email", email);
  url.searchParams.set("phone", celular13);
  return url.toString();
};

export const SubscriptionForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", celular: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();

  // Retoma inscrição pendente salva no navegador.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("verificar-status", {
        body: { id: stored },
      });
      if (error || !data?.found) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setSuccess({
        id: stored,
        nome: data.nome,
        email: "",
        celular: "",
      });
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = subscriptionSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const celular13 = toE164Digits(result.data.celular);
    const email = result.data.email.toLowerCase();
    
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("criar-inscricao", {
      body: {
        nome: result.data.nome,
        email,
        celular: celular13,
      },
    });
    setLoading(false);

    if (error || !data?.id) {
      toast({
        title: "Não foi possível enviar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem(STORAGE_KEY, data.id);
    setSuccess({
      id: data.id,
      nome: data.nome,
      email: data.email ?? email,
      celular: data.celular,
    });
    toast({
      title: "Inscrição registrada 🌸",
      description: "Suas informações foram salvas com sucesso.",
    });
  };

  if (success) {
    return (
      <SuccessPanel
        data={success}
        onNew={() => {
          localStorage.removeItem(STORAGE_KEY);
          setSuccess(null);
          setForm({ nome: "", email: "", celular: "" });
        }}
      />
    );
  }

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto bg-ivory border border-rose-dusty/40 p-8 md:p-12 shadow-petal"
      noValidate
    >
      <div className="space-y-6">
        <Field id="nome" label="Nome completo" error={errors.nome}>
          <Input
            id="nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Seu nome"
            maxLength={120}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
        </Field>

        <Field id="email" label="E-mail" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="voce@email.com"
            maxLength={255}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
        </Field>

        <Field id="celular" label="Número de celular" error={errors.celular}>
          <Input
            id="celular"
            type="tel"
            inputMode="numeric"
            value={form.celular}
            onChange={(e) => setForm((f) => ({ ...f, celular: formatPhoneMask(e.target.value) }))}
            placeholder="(00) 00000-0000"
            maxLength={16}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
        </Field>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full mt-10 rounded-none h-auto min-h-[68px] py-5 px-6 transition-elegant shadow-petal disabled:opacity-70 whitespace-normal"
        style={{ backgroundColor: "#98545B", color: "hsl(var(--primary-foreground))" }}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
        ) : (
          <span className="tracking-[0.2em] sm:tracking-[0.3em] uppercase text-sm sm:text-base md:text-lg font-light">
            INSCRIÇÃO — R$ 44,90
          </span>
        )}
      </Button>

    </form>
      <p className="mt-4 text-center text-[10px] tracking-widest uppercase text-sage/60">
        Pagamento seguro via The Bank
      </p>
    </>
  );
};

const SuccessPanel = ({ data, onNew }: { data: SuccessData; onNew: () => void }) => {
  const [status, setStatus] = useState<StatusValue>("pendente");
  const [checking, setChecking] = useState(false);
  const timerRef = useRef<number | null>(null);

  const checkoutUrl = data.celular
    ? buildCheckoutUrl(data.nome, data.email, data.celular)
    : PAYMENT_BASE_URL;

  const fetchStatus = async () => {
    setChecking(true);
    const { data: row } = await supabase.functions.invoke("verificar-status", {
      body: { id: data.id },
    });
    setChecking(false);
    if (row?.status) setStatus(row.status as StatusValue);
  };

  useEffect(() => {
    fetchStatus();
    timerRef.current = window.setInterval(fetchStatus, 8000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id]);

  const isPaid = status === "pago";
  const isRejected = status === "recusado" || status === "chargeback" || status === "reembolsado";

  // Redireciona para a página de agradecimento quando o pagamento é confirmado.
  useEffect(() => {
    if (!isPaid) return;
    const timer = window.setTimeout(() => navigate(`/obrigado?id=${data.id}`), 1200);
    return () => window.clearTimeout(timer);
  }, [isPaid, data.id, navigate]);

  return (
    <div className="max-w-2xl mx-auto bg-ivory border border-rose-dusty/40 p-8 md:p-14 text-center shadow-petal animate-fade-up">
      <Heart className="w-10 h-10 mx-auto text-rose-deep mb-6" strokeWidth={1.2} />
      <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-4">
        {isPaid ? "Vaga confirmada" : "Nome registrado"}
      </p>
      <h3 className="font-display text-3xl md:text-5xl text-foreground mb-4">
        Que alegria, <span className="italic text-rose-deep">{data.nome.split(" ")[0]}</span>!
      </h3>

      <StatusBadge status={status} checking={checking} />

      <p className="text-foreground/70 font-light leading-relaxed max-w-md mx-auto mt-6 mb-8">
        {isPaid
          ? "Seu pagamento foi confirmado. Você será redirecionada para a página de confirmação..."
          : isRejected
          ? "Não conseguimos confirmar seu pagamento. Você pode tentar novamente pelo botão abaixo."
          : "Sua pré-inscrição foi realizada. Clique no botão abaixo para concluir o pagamento."}
      </p>

      {!isPaid && (
        <Button
          onClick={() => window.open(checkoutUrl, "_blank")}
          className="w-full sm:w-auto px-10 py-6 mb-10 rounded-none h-auto transition-elegant shadow-petal gap-2"
          style={{ backgroundColor: "#98545B", color: "hsl(var(--primary-foreground))" }}
        >
          <span className="tracking-[0.2em] uppercase text-sm font-light">
            Concluir Pagamento
          </span>
          <ExternalLink className="w-4 h-4 opacity-70" />
        </Button>
      )}

      {isPaid && (
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sage mb-8">
          <Loader2 className="w-3 h-3 animate-spin" /> Redirecionando...
        </div>
      )}

      <div className="border-t border-rose-dusty/30 pt-8 mb-8 space-y-3 text-left max-w-sm mx-auto">
        <Row label="Nome" value={data.nome} />
        {data.email && <Row label="E-mail" value={data.email} />}
        <Row label="Data" value="19 de Setembro · 15:30h" />
        <Row label="Local" value="SALÃO DE FESTAS · RESIDENCIAL ILHAS GALAPAGOS · RUA FLEMINGTON QD 1 LT21 · VILA DOS ALPES · GOIÂNIA - GO" />
        <Row label="Código" value={data.id.slice(0, 8).toUpperCase()} />
      </div>


      <button
        type="button"
        onClick={onNew}
        className="block mx-auto mt-6 text-xs tracking-widest uppercase text-sage hover:text-rose-deep transition-colors"
      >
        {isPaid ? "Nova inscrição" : "Descartar e recomeçar"}
      </button>
    </div>
  );
};

const StatusBadge = ({ status, checking }: { status: StatusValue; checking: boolean }) => {
  const map: Record<StatusValue, { icon: React.ElementType; label: string; className: string }> = {
    pago: { icon: CheckCircle2, label: "Pagamento confirmado", className: "bg-sage/15 text-sage border-sage/40" },
    pendente: { icon: Clock, label: "Aguardando pagamento", className: "bg-rose-soft/40 text-rose-deep border-rose-dusty/50" },
    recusado: { icon: XCircle, label: "Pagamento recusado", className: "bg-destructive/10 text-destructive border-destructive/40" },
    reembolsado: { icon: XCircle, label: "Pagamento reembolsado", className: "bg-destructive/10 text-destructive border-destructive/40" },
    chargeback: { icon: XCircle, label: "Chargeback", className: "bg-destructive/10 text-destructive border-destructive/40" },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 border text-xs tracking-[0.2em] uppercase ${cfg.className}`}>
      <Icon className="w-4 h-4" strokeWidth={1.5} />
      {cfg.label}
      {checking && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
    </div>
  );
};

const Field = ({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="uppercase tracking-[0.2em] text-xs text-rose-deep font-light">
      {label}
    </Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="uppercase tracking-[0.2em] text-xs text-sage shrink-0">{label}</span>
    <span className="text-foreground font-light text-right">{value}</span>
  </div>
);

export default SubscriptionForm;
