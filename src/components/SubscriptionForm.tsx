import { useState } from "react";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart, ExternalLink } from "lucide-react";

const KIWIFY_CHECKOUT_URL = "https://pay.kiwify.com.br/KEIHMK5";

const subscriptionSchema = z.object({
  full_name: z.string().trim().min(2, { message: "Informe seu nome completo" }).max(120, { message: "Nome muito longo" }),
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255, { message: "E-mail muito longo" }),
  phone: z.string().trim().regex(/^\(\d{2}\)\s\d{5}-\d{4}$/, { message: "Telefone inválido. Use (11) 91234-5678" }),
  prayer_request: z.string().trim().max(1000, { message: "Pedido de oração muito longo" }).optional(),
});

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

type SuccessData = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
};

export const SubscriptionForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", prayer_request: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    setLoading(true);
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        full_name: result.data.full_name,
        email: result.data.email,
        phone: result.data.phone,
        prayer_request: result.data.prayer_request || null,
      })
      .select("id, full_name, email, phone")
      .single();
    setLoading(false);

    if (error || !data) {
      toast({
        title: "Não foi possível enviar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }

    setSuccess(data as SuccessData);
    toast({
      title: "Inscrição registrada 🌸",
      description: "Redirecionando para o pagamento...",
    });

    // Try to open in a new tab; if blocked, redirect in the same tab
    const popup = window.open(KIWIFY_CHECKOUT_URL, "_blank", "noopener,noreferrer");
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      window.location.href = KIWIFY_CHECKOUT_URL;
    }
  };

  if (success) {
    const qrPayload = JSON.stringify({
      evento: "3º Encontro das Magnólias",
      data: "23/05/2025 - 15:30h",
      local: "Goiânia",
      inscricao: success.id,
      nome: success.full_name,
      email: success.email,
      telefone: success.phone,
    });

    return (
      <div className="max-w-2xl mx-auto bg-ivory border border-rose-dusty/40 p-8 md:p-14 text-center shadow-petal animate-fade-up">
        <Heart className="w-10 h-10 mx-auto text-rose-deep mb-6" strokeWidth={1.2} />
        <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-4">Convite de entrada</p>
        <h3 className="font-display text-3xl md:text-5xl text-foreground mb-4">
          Que alegria, <span className="italic text-rose-deep">{success.full_name.split(" ")[0]}</span>!
        </h3>
        <p className="text-foreground/70 font-light leading-relaxed max-w-md mx-auto mb-10">
          Sua inscrição foi registrada. Conclua o pagamento na aba aberta e
          apresente este QR Code na entrada do evento.
        </p>

        <div className="inline-block bg-white p-6 border border-rose-dusty/40 shadow-soft mb-8">
          <QRCodeSVG
            value={qrPayload}
            size={220}
            level="M"
            fgColor="#9d4d5a"
            bgColor="#ffffff"
          />
        </div>

        <div className="border-t border-rose-dusty/30 pt-8 mb-8 space-y-3 text-left max-w-sm mx-auto">
          <Row label="Nome" value={success.full_name} />
          <Row label="E-mail" value={success.email} />
          <Row label="Telefone" value={success.phone} />
          <Row label="Data" value="23 de Maio · 15:30h" />
          <Row label="Local" value="Goiânia" />
          <Row label="Código" value={success.id.slice(0, 8).toUpperCase()} />
        </div>

        <Button
          onClick={() => window.open(KIWIFY_CHECKOUT_URL, "_blank", "noopener,noreferrer")}
          className="rounded-none px-10 py-6 text-sm tracking-[0.25em] uppercase font-light transition-elegant shadow-petal"
          style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Reabrir pagamento
        </Button>

        <p className="mt-6 text-xs tracking-widest uppercase text-sage">
          Salve esta tela ou tire um print
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto bg-ivory border border-rose-dusty/40 p-8 md:p-12 shadow-petal"
      noValidate
    >
      <div className="space-y-6">
        <Field id="full_name" label="Nome completo" error={errors.full_name}>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Seu nome"
            maxLength={120}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
        </Field>

        <Field id="email" label="E-mail" error={errors.email}>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="seu@email.com"
            maxLength={255}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
        </Field>

        <Field id="phone" label="Telefone" error={errors.phone}>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            placeholder="(11) 91234-5678"
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
        </Field>

        <Field id="prayer_request" label="Pedido de oração (opcional)" error={errors.prayer_request}>
          <Textarea
            id="prayer_request"
            value={form.prayer_request}
            onChange={(e) => setForm({ ...form, prayer_request: e.target.value })}
            placeholder="Compartilhe o que está em seu coração..."
            maxLength={1000}
            rows={4}
            className="rounded-none border border-rose-dusty/50 bg-transparent focus-visible:ring-0 focus-visible:border-rose-deep resize-none text-base"
          />
        </Field>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full mt-10 rounded-none h-auto min-h-[68px] py-5 px-6 transition-elegant shadow-petal disabled:opacity-70 whitespace-normal"
        style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
        ) : (
          <span className="flex items-center justify-center gap-4 sm:gap-5 flex-nowrap leading-tight">
            <span className="tracking-[0.25em] uppercase text-[12px] sm:text-sm font-light">
              Valor da inscrição
            </span>
            <span className="tracking-[0.25em] uppercase text-[12px] sm:text-sm font-light">
              R$ 39,90
            </span>
          </span>
        )}
      </Button>

      <p className="mt-6 text-center text-xs tracking-widest uppercase text-sage">
        Pagamento seguro via Kiwify
      </p>
    </form>
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
    <span className="text-foreground font-light text-right truncate">{value}</span>
  </div>
);

export default SubscriptionForm;
