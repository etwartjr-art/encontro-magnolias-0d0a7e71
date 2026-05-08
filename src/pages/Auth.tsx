import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/admin", { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Falha no login", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/admin", { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-ivory border border-rose-dusty/40 p-8 md:p-12 shadow-petal"
      >
        <Lock className="w-8 h-8 mx-auto text-rose-deep mb-4" strokeWidth={1.2} />
        <h1 className="font-display text-3xl text-center text-foreground mb-2">Área Administrativa</h1>
        <p className="text-center text-sm text-foreground/60 mb-8">Acesso restrito</p>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="uppercase tracking-[0.2em] text-xs text-rose-deep font-light">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="uppercase tracking-[0.2em] text-xs text-rose-deep font-light">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-none border-0 border-b border-rose-dusty/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-rose-deep h-12"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full mt-10 rounded-none h-14 transition-elegant shadow-petal"
          style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="tracking-[0.3em] uppercase text-sm font-light">Entrar</span>}
        </Button>
      </form>
    </main>
  );
};

export default Auth;
