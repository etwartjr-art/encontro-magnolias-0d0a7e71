import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo").max(120, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
});

export const RsvpForm = () => {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ nome, email });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErros({
        nome: f.nome?.[0] ?? "",
        email: f.email?.[0] ?? "",
      });
      return;
    }
    setErros({});
    setLoading(true);
    const { error } = await supabase.from("rsvps").insert({
      nome: parsed.data.nome,
      email: parsed.data.email,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Não foi possível confirmar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }
    setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="max-w-xl mx-auto bg-ivory border border-rose-dusty/40 p-10 sm:p-12 text-center shadow-soft">
        <Check className="w-8 h-8 mx-auto mb-5 text-rose-deep" strokeWidth={1.2} />
        <p className="font-display text-2xl sm:text-3xl text-rose-deep mb-3">
          Nome registrado
        </p>
        <p className="text-sm text-foreground/70 font-light">
          Obrigada, {nome.split(" ")[0]}! Guardamos seu nome com carinho.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto bg-ivory border border-rose-dusty/40 p-8 sm:p-10 shadow-soft space-y-6"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="rsvp-nome" className="uppercase tracking-[0.2em] text-[10px] text-sage">
          Nome completo
        </Label>
        <Input
          id="rsvp-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={120}
          autoComplete="name"
          className="rounded-none border-rose-dusty/50 bg-transparent"
          placeholder="Seu nome"
        />
        {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="rsvp-email" className="uppercase tracking-[0.2em] text-[10px] text-sage">
          E-mail
        </Label>
        <Input
          id="rsvp-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          autoComplete="email"
          className="rounded-none border-rose-dusty/50 bg-transparent"
          placeholder="voce@email.com"
        />
        {erros.email && <p className="text-xs text-destructive">{erros.email}</p>}
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-none py-6 text-xs tracking-[0.3em] uppercase font-light shadow-petal"
        style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar presença"}
      </Button>
    </form>
  );
};
