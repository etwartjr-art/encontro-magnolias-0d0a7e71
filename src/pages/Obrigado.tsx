import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Calendar, Clock, MapPin, Download, Share2, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StatusValue = "pendente" | "pago" | "recusado" | "reembolsado" | "chargeback";

type InscricaoData = {
  found: boolean;
  status: StatusValue;
  nome: string;
  pago_em: string | null;
};

const EVENT_DATE = "19 de Setembro de 2026";
const EVENT_TIME = "15:30h";
const EVENT_LOCATION = "SALÃO DE FESTAS · RESIDENCIAL ILHAS GALAPAGOS · RUA FLEMINGTON QD 1 LT21 · VILA DOS ALPES · GOIÂNIA - GO";

export default function Obrigado() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InscricaoData | null>(null);
  const [ticketToken, setTicketToken] = useState<string | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: res, error } = await supabase.functions.invoke("verificar-status", {
          body: { id },
        });
        if (cancelled) return;
        if (error || !res?.found) {
          navigate("/", { replace: true });
          return;
        }
        setData(res as InscricaoData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // Se ainda não pagou, redireciona para a página inicial após breve aviso.
  useEffect(() => {
    if (!loading && data && data.status !== "pago") {
      const timer = setTimeout(() => navigate("/", { replace: true }), 4000);
      return () => clearTimeout(timer);
    }
  }, [loading, data, navigate]);

  // Emite o ticket assim que confirmamos que está pago.
  useEffect(() => {
    if (!id || !data || data.status !== "pago" || ticketToken || ticketLoading) return;

    let cancelled = false;
    setTicketLoading(true);
    (async () => {
      const { data: res, error } = await supabase.functions.invoke("emitir-ticket", {
        body: { id },
      });
      if (cancelled) return;
      if (!error && res?.token) {
        setTicketToken(res.token as string);
      }
      setTicketLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [data, id, ticketToken, ticketLoading]);

  const handleShare = async () => {
    const text = `Minha inscrição no Encontro das Magnólias está confirmada! ${EVENT_DATE} às ${EVENT_TIME}.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Encontro das Magnólias", text });
      } catch {
        // usuário cancelou
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado!", description: "Mensagem copiada para a área de transferência." });
    }
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector("#ticket-qr svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `comprovante-encontro-das-magnolias-${id?.slice(0, 8)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center px-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-rose-deep mb-4" />
          <p className="uppercase tracking-[0.3em] text-xs text-sage">Carregando confirmação...</p>
        </div>
      </div>
    );
  }

  if (!data || data.status !== "pago") {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <Clock className="w-10 h-10 mx-auto text-rose-deep mb-6" strokeWidth={1.2} />
          <h1 className="font-display text-3xl text-foreground mb-4">Aguardando confirmação</h1>
          <p className="text-foreground/70 font-light mb-8">
            Seu pagamento ainda não foi confirmado. Você será redirecionada para a página inicial em instantes.
          </p>
          <Button
            onClick={() => navigate("/", { replace: true })}
            className="rounded-none px-8 py-5 tracking-[0.2em] uppercase text-sm font-light"
            style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
          >
            Voltar ao site
          </Button>
        </div>
      </div>
    );
  }

  const primeiroNome = data.nome?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-ivory text-foreground overflow-x-hidden">
      <header className="relative w-full overflow-hidden gradient-soft pb-10 sm:pb-14">
        <div className="relative max-w-3xl mx-auto px-6 sm:px-10 pt-10 sm:pt-16 md:pt-20 flex flex-col items-center text-center">
          <img
            src="/img/logo-oficial-das-magnolias.jpeg"
            alt="Encontro das Magnólias"
            width={320}
            height={320}
            className="w-40 sm:w-52 md:w-64 h-auto rounded-full shadow-soft animate-fade-up"
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 sm:px-10 pb-20 sm:pb-28 -mt-6">
        <section className="bg-ivory border border-rose-dusty/40 p-8 md:p-12 text-center shadow-petal animate-fade-up">
          <CheckCircle2 className="w-12 h-12 mx-auto text-sage mb-6" strokeWidth={1.2} />

          <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-4">
            Pagamento confirmado
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground mb-4">
            Obrigada, <span className="italic text-rose-deep">{primeiroNome}</span>!
          </h1>
          <p className="text-foreground/70 font-light leading-relaxed max-w-md mx-auto">
            Sua vaga no Encontro das Magnólias está garantida. Estamos preparando tudo com muito carinho para te receber.
          </p>

          <div className="mt-10 mb-10">
            {ticketToken ? (
              <div className="inline-block bg-white p-6 border border-rose-dusty/40 shadow-soft" id="ticket-qr">
                <QRCodeSVG value={ticketToken} size={220} level="M" fgColor="#9d4d5a" bgColor="#ffffff" />
                <p className="mt-4 uppercase tracking-[0.2em] text-[10px] text-sage">
                  Apresente na entrada
                </p>
              </div>
            ) : ticketLoading ? (
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sage">
                <Loader2 className="w-3 h-3 animate-spin" /> Gerando comprovante seguro...
              </div>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Button
              onClick={handleDownloadQR}
              disabled={!ticketToken}
              className="w-full sm:w-auto rounded-none px-8 py-5 tracking-[0.15em] uppercase text-xs font-light gap-2 transition-elegant shadow-soft"
              style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
            >
              <Download className="w-4 h-4" />
              Salvar comprovante
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              className="w-full sm:w-auto rounded-none px-8 py-5 tracking-[0.15em] uppercase text-xs font-light gap-2 border-rose-dusty/50 hover:bg-rose-soft/30"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar
            </Button>
          </div>

          <div className="border-t border-rose-dusty/30 pt-8 mb-8 space-y-4 text-left max-w-md mx-auto">
            <InfoRow icon={Calendar} label="Data" value={EVENT_DATE} />
            <InfoRow icon={Clock} label="Horário" value={EVENT_TIME} />
            <InfoRow icon={MapPin} label="Local" value={EVENT_LOCATION} />
          </div>
        </section>

        <section className="mt-8 bg-cream border border-rose-dusty/30 p-8 md:p-10 shadow-soft animate-fade-up">
          <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-6 text-center">
            Instruções para o <span className="italic text-rose-deep">dia</span>
          </h2>

          <ul className="space-y-4 text-foreground/80 font-light leading-relaxed">
            <li className="flex gap-3">
              <span className="text-rose-deep mt-1">•</span>
              <span>Chegue com <strong>15 minutos de antecedência</strong> para recebermos você com tranquilidade.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-rose-deep mt-1">•</span>
              <span>Apresente o <strong>QR Code acima</strong> na entrada do evento. Você pode salvá-lo no celular ou imprimir.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-rose-deep mt-1">•</span>
              <span>O estacionamento é interno do condomínio, mas recomendamos <strong>chegar cedo</strong> para garantir vaga próxima ao salão.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-rose-deep mt-1">•</span>
              <span>Vista-se confortavelmente. O evento é um momento de comunhão, adoração e cuidado entre mulheres.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-rose-deep mt-1">•</span>
              <span>Em caso de dúvida, entre em contato pelo WhatsApp disponível na página inicial.</span>
            </li>
          </ul>
        </section>

        <div className="mt-10 text-center">
          <Button
            onClick={() => navigate("/", { replace: true })}
            variant="ghost"
            className="rounded-none px-6 py-4 tracking-[0.2em] uppercase text-xs font-light text-sage hover:text-rose-deep gap-2"
          >
            <Home className="w-4 h-4" />
            Voltar ao site
          </Button>
        </div>
      </main>

      <footer className="py-12 sm:py-16 px-5 sm:px-6 bg-cream border-t border-rose-dusty/30">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-display italic text-xl sm:text-2xl text-rose-deep mb-3">
            Encontro das Magnólias
          </p>
          <p className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-sage leading-relaxed">
            SÉTIMA EDIÇÃO · GOIÂNIA · 19 DE SETEMBRO · 15:30H
          </p>
        </div>
      </footer>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <Icon className="w-5 h-5 text-rose-deep shrink-0 mt-0.5" strokeWidth={1.2} />
      <div>
        <p className="uppercase tracking-[0.2em] text-[10px] text-sage mb-1">{label}</p>
        <p className="text-foreground font-light leading-snug">{value}</p>
      </div>
    </div>
  );
}
