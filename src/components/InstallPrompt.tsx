import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "magnolias-install-dismissed";

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Skip in iframe / preview
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Already installed?
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const inStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;

    if (iOS && !inStandalone) {
      setIsIOS(true);
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 2500);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:bottom-6 sm:left-auto sm:right-6 sm:px-0 animate-fade-up">
      <div className="mx-auto sm:mx-0 max-w-md rounded-2xl border border-rose-dusty/30 bg-ivory shadow-2xl p-5 backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-deep/10">
            <Download className="h-6 w-6 text-rose-deep" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg text-rose-deep leading-tight">
              Instale o app das Magnólias
            </h3>
            {isIOS ? (
              <p className="mt-1 text-sm text-foreground/70">
                Toque em <Share className="inline h-4 w-4 mx-1" /> e depois em
                <span className="font-medium"> "Adicionar à Tela de Início"</span>.
              </p>
            ) : (
              <p className="mt-1 text-sm text-foreground/70">
                Tenha acesso rápido ao convite, direto da sua tela inicial.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              {!isIOS && (
                <Button
                  onClick={install}
                  size="sm"
                  className="bg-rose-deep hover:bg-rose-deep/90 text-ivory"
                >
                  Instalar
                </Button>
              )}
              <Button
                onClick={dismiss}
                size="sm"
                variant="ghost"
                className="text-foreground/60"
              >
                Agora não
              </Button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="text-foreground/40 hover:text-foreground/70 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
