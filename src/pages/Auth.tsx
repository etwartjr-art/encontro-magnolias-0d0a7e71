import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";

const Auth = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const nextParam = new URLSearchParams(window.location.search).get("next");
  const destino = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : "/admin";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(destino);
    });
  }, [destino]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Falha no login", description: error.message, variant: "destructive" });
      return;
    }
    window.location.replace(destino);
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${destino}`,
    });
    if (result.error) {
      setLoading(false);
      toast({ title: "Falha no login com Google", description: result.error.message, variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    window.location.replace(destino);
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-rose-dusty/40" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-[0.3em]">
            <span className="bg-ivory px-3 text-foreground/50">ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={handleGoogle}
          className="w-full rounded-none h-14 border-rose-dusty/50 bg-transparent hover:bg-rose-dusty/10"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="tracking-[0.2em] uppercase text-sm font-light">Entrar com Google</span>
        </Button>
      </form>
    </main>
  );
};

export default Auth;
