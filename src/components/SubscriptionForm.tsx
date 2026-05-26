import { useState } from "react";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart, ExternalLink } from "lucide-react";
import { formatFullAddress } from "@/lib/eventAddress";

const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfYBonhqAqs9HaRoo_VhAjPQxmR7DtOe-oVMO31Jy26-Trqew/viewform?usp=dialog";

const subscriptionSchema = z.object({
  full_name: z.string().trim().min(2, { message: "Informe seu nome completo" }).max(120, { message: "Nome muito longo" }),
});

type SuccessData = {
  id: string;
  full_name: string;
};

export const SubscriptionForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [form, setForm] = useState({ full_name: "" });
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

    // Open form immediately within the user gesture to avoid popup blockers
    const formWindow = window.open(FORM_URL, "_blank", "noopener,noreferrer");

    setLoading(true);
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        full_name: result.data.full_name,
        phone: "",
      })
      .select("id, full_name")
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
      description: "Abrindo o formulário de inscrição...",
    });

    if (!formWindow || formWindow.closed || typeof formWindow.closed === "undefined") {
      window.location.href = FORM_URL;
    }
  };

  if (success) {
    const qrPayload = JSON.stringify({
      evento: "4º Encontro das Magnólias",
      data: "27/06/2026 - 15:30h",
      local: "Local a Definir",
      inscricao: success.id,
      nome: success.full_name,
    });

    return (
      <div className="max-w-2xl mx-auto bg-ivory border border-rose-dusty/40 p-8 md:p-14 text-center shadow-petal animate-fade-up">
        <Heart className="w-10 h-10 mx-auto text-rose-deep mb-6" strokeWidth={1.2} />
        <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-4">Convite de entrada</p>
        <h3 className="font-display text-3xl md:text-5xl text-foreground mb-4">
          Que alegria, <span className="italic text-rose-deep">{success.full_name.split(" ")[0]}</span>!
        </h3>
        <p className="text-foreground/70 font-light leading-relaxed max-w-md mx-auto mb-10">
          Sua inscrição foi registrada. Finalize preenchendo o formulário na
          aba aberta e apresente este QR Code na entrada do evento.
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
          <Row label="Data" value="27 de Junho · 15:30h" />
          <Row label="Local" value="Local a Definir" />
          <Row label="Código" value={success.id.slice(0, 8).toUpperCase()} />
        </div>

        <Button
          onClick={() => window.open(FORM_URL, "_blank", "noopener,noreferrer")}
          className="rounded-none px-10 py-6 text-sm tracking-[0.25em] uppercase font-light transition-elegant shadow-petal"
          style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Reabrir formulário
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
            onChange={(e) => setForm({ full_name: e.target.value })}
            placeholder="Seu nome"
            maxLength={120}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
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
          <span className="tracking-[0.2em] sm:tracking-[0.3em] uppercase text-sm sm:text-base md:text-lg font-light">
            Inscrição R$39,90
          </span>
        )}
      </Button>

      <p className="mt-6 text-center text-xs tracking-widest uppercase text-sage">
        Inscrição via formulário
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
