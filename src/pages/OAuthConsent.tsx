import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Pedido de autorização inválido (authorization_id ausente).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não devolveu um endereço de retorno.");
      return;
    }
    window.location.href = target;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-ivory border border-rose-dusty/40 p-8 md:p-12 shadow-petal text-center">
        {error ? (
          <>
            <h1 className="font-display text-2xl text-foreground mb-3">Não foi possível continuar</h1>
            <p className="text-sm text-foreground/70">{error}</p>
          </>
        ) : !details ? (
          <div className="flex items-center justify-center gap-3 text-foreground/70">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl text-foreground mb-3">
              Conectar {details.client?.name ?? "aplicativo"} à sua conta
            </h1>
            <p className="text-sm text-foreground/70 mb-8">
              Isso permite que {details.client?.name ?? "o aplicativo"} acesse os dados do site como você.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 rounded-none h-12 border-rose-dusty/50 bg-transparent"
              >
                Recusar
              </Button>
              <Button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 rounded-none h-12"
                style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aprovar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default OAuthConsent;
