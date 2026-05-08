import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Users } from "lucide-react";

type Subscription = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  created_at: string;
};

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Subscription[]>([]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/auth", { replace: true });
        return;
      }
      const userId = sessionData.session.user.id;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roles) {
        toast({ title: "Acesso negado", description: "Esta conta não é administradora.", variant: "destructive" });
        await supabase.auth.signOut();
        navigate("/auth", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, full_name, email, phone, created_at")
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      } else {
        setItems(data ?? []);
      }
      setLoading(false);
    };

    init();
    return () => { active = false; };
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-rose-deep" strokeWidth={1.2} />
            <div>
              <p className="uppercase tracking-[0.3em] text-xs text-rose-deep">Administração</p>
              <h1 className="font-display text-3xl md:text-4xl text-foreground">Inscrições</h1>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="rounded-none uppercase tracking-[0.2em] text-xs"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-rose-deep" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-foreground/60 py-20 font-light">Nenhuma inscrição registrada ainda.</p>
        ) : (
          <div className="bg-ivory border border-rose-dusty/40 shadow-petal overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-rose-dusty/40">
                <tr className="text-left">
                  <th className="px-5 py-4 uppercase tracking-[0.2em] text-xs text-rose-deep font-light">#</th>
                  <th className="px-5 py-4 uppercase tracking-[0.2em] text-xs text-rose-deep font-light">Nome completo</th>
                  <th className="px-5 py-4 uppercase tracking-[0.2em] text-xs text-rose-deep font-light">Data</th>
                  <th className="px-5 py-4 uppercase tracking-[0.2em] text-xs text-rose-deep font-light">Código</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s, i) => (
                  <tr key={s.id} className="border-b border-rose-dusty/20 last:border-0">
                    <td className="px-5 py-4 text-foreground/60">{i + 1}</td>
                    <td className="px-5 py-4 text-foreground font-light">{s.full_name}</td>
                    <td className="px-5 py-4 text-foreground/70 font-light">
                      {new Date(s.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-4 text-foreground/70 font-mono text-xs">
                      {s.id.slice(0, 8).toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-foreground/50 border-t border-rose-dusty/30">
              Total: {items.length} inscrição(ões)
            </p>
          </div>
        )}
      </div>
    </main>
  );
};

export default Admin;
