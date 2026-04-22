import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart } from "lucide-react";

const subscriptionSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Informe seu nome completo" })
    .max(120, { message: "Nome muito longo" }),
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .max(255, { message: "E-mail muito longo" }),
  phone: z
    .string()
    .trim()
    .regex(/^\(\d{2}\)\s\d{5}-\d{4}$/, {
      message: "Telefone inválido. Use (11) 91234-5678",
    }),
  prayer_request: z
    .string()
    .trim()
    .max(1000, { message: "Pedido de oração muito longo" })
    .optional(),
});

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const SubscriptionForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    prayer_request: "",
  });
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
    const { error } = await supabase.from("subscriptions").insert({
      full_name: result.data.full_name,
      email: result.data.email,
      phone: result.data.phone,
      prayer_request: result.data.prayer_request || null,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Não foi possível enviar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }

    setSubmitted(true);
    toast({
      title: "Inscrição recebida 🌸",
      description: "Em breve enviaremos os detalhes do pagamento.",
    });
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto bg-ivory border border-rose-dusty/40 p-12 md:p-16 text-center shadow-petal animate-fade-up">
        <Heart className="w-10 h-10 mx-auto text-rose-deep mb-6" strokeWidth={1.2} />
        <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-4">Inscrição recebida</p>
        <h3 className="font-display text-3xl md:text-4xl text-foreground mb-6">
          Que alegria ter você <span className="italic text-rose-deep">conosco</span>
        </h3>
        <p className="text-foreground/70 font-light leading-relaxed">
          Em instantes você receberá no seu e-mail os detalhes para confirmar o
          pagamento e garantir sua vaga.
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
        <div className="space-y-2">
          <Label htmlFor="full_name" className="uppercase tracking-[0.2em] text-xs text-rose-deep font-light">
            Nome completo
          </Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Seu nome"
            maxLength={120}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
          {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="uppercase tracking-[0.2em] text-xs text-rose-deep font-light">
            E-mail
          </Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="seu@email.com"
            maxLength={255}
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="uppercase tracking-[0.2em] text-xs text-rose-deep font-light">
            Telefone
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            placeholder="(11) 91234-5678"
            className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12 text-base"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prayer_request" className="uppercase tracking-[0.2em] text-xs text-rose-deep font-light">
            Pedido de oração <span className="text-muted-foreground normal-case tracking-normal">(opcional)</span>
          </Label>
          <Textarea
            id="prayer_request"
            value={form.prayer_request}
            onChange={(e) => setForm({ ...form, prayer_request: e.target.value })}
            placeholder="Compartilhe o que está em seu coração..."
            maxLength={1000}
            rows={4}
            className="rounded-none border border-rose-dusty/50 bg-transparent focus-visible:ring-0 focus-visible:border-rose-deep resize-none text-base"
          />
          {errors.prayer_request && <p className="text-xs text-destructive">{errors.prayer_request}</p>}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full mt-10 rounded-none py-7 text-sm tracking-[0.25em] uppercase font-light transition-elegant shadow-petal disabled:opacity-70"
        style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
          </>
        ) : (
          <>Garantir minha vaga &nbsp;·&nbsp; R$ 39,90</>
        )}
      </Button>

      <p className="mt-6 text-center text-xs tracking-widest uppercase text-sage">
        Vagas limitadas
      </p>
    </form>
  );
};

export default SubscriptionForm;
