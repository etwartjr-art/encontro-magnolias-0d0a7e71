import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Loader2 } from "lucide-react";
import branchImage from "@/assets/magnolia-branch.webp";

const SubscriptionForm = lazy(() =>
  import("@/components/SubscriptionForm").then((m) => ({ default: m.SubscriptionForm })),
);
import { Reveal } from "@/components/Reveal";
import { RsvpForm } from "@/components/RsvpForm";
// Endereço não exibido nesta edição — local a definir

const Index = () => {
  return (
    <div className="min-h-screen bg-ivory text-foreground overflow-x-hidden">
      {/* HERO BANNER */}
      <header className="relative w-full overflow-hidden">
        <img
          src="/img/magnolia-banner-640.webp"
          srcSet="/img/magnolia-banner-640.webp 640w, /img/magnolia-banner-960.webp 960w, /__l5e/assets-v1/eb6a78d3-453c-4ca9-a9a8-a4e455d51f66/magnolia-banner-v6.webp 1280w"
          sizes="100vw"
          alt="6º Encontro das Magnólias"
          width={1280}
          height={854}
          fetchPriority="high"
          decoding="async"
          className="w-full h-auto object-cover animate-ken-burns will-change-transform scale-110"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-shimmer mix-blend-soft-light"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 50%, hsl(var(--rose-soft) / 0.55) 0%, transparent 70%)",
          }}
        />
      </header>

      {/* INTRO */}
      <section className="py-14 sm:py-20 md:py-28 px-5 sm:px-6 gradient-soft">
        <div className="max-w-2xl mx-auto text-center animate-fade-up">
          <p className="uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs text-rose-deep mb-5 sm:mb-6">
            Mulheres que florescem na presença de Deus
          </p>
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <span className="h-px w-8 sm:w-12 bg-rose-dusty" />
            <span className="font-display italic text-rose-dusty text-base sm:text-lg">Sexta edição</span>
            <span className="h-px w-8 sm:w-12 bg-rose-dusty" />
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground/90 leading-tight mb-6 sm:mb-8">
            Com grande alegria,
            <br />
            <span className="italic text-rose-deep">convidamos você</span>
          </h1>

          <p className="text-foreground/70 text-sm sm:text-base md:text-lg leading-relaxed font-light">
            Para o nosso sexto encontro, um momento preparado com muito{" "}
            <span className="italic text-rose-deep">amor, fé e propósito</span>.
            Um tempo para mulheres que desejam crescer em Deus, fortalecer
            laços e viver o extraordinário dEle.
          </p>
        </div>
      </section>

      {/* VERSE */}
      <section className="relative py-20 sm:py-28 md:py-36 px-5 sm:px-6 bg-ivory overflow-hidden">
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -left-12 sm:-left-16 top-6 sm:top-10 w-36 sm:w-56 opacity-30 sm:opacity-40 -rotate-12 animate-float pointer-events-none"
          loading="lazy"
        />
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -right-12 sm:-right-16 bottom-6 sm:bottom-10 w-36 sm:w-56 opacity-30 sm:opacity-40 rotate-[200deg] animate-float pointer-events-none"
          loading="lazy"
        />

        <Reveal variant="up" className="relative max-w-3xl mx-auto text-center">
          <div className="inline-block mb-8 sm:mb-10">
            <div className="w-12 sm:w-16 h-px bg-rose-dusty mx-auto mb-4 sm:mb-6" />
            <p className="uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs text-rose-deep">Salmos 1:3</p>
            <div className="w-12 sm:w-16 h-px bg-rose-dusty mx-auto mt-4 sm:mt-6" />
          </div>

          <blockquote className="font-display italic text-base sm:text-2xl md:text-4xl lg:text-5xl leading-relaxed text-foreground/85 px-2">
            "Pois será como a árvore plantada
            <br />
            junto a ribeiros de águas,
            <br />
            a qual dá o seu fruto na estação própria,
            <br />
            <span className="text-rose-deep">e cujas folhas não caem;</span>
            <br />
            e tudo quanto fizer prosperará."
          </blockquote>
        </Reveal>
      </section>

      {/* DETAILS */}
      <section className="py-16 sm:py-24 md:py-32 px-5 sm:px-6 bg-cream">
        <div className="max-w-5xl mx-auto">
          <Reveal variant="up" className="text-center mb-12 sm:mb-16">
            <p className="uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs text-rose-deep mb-4 sm:mb-6">O Encontro</p>
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground">
              Reserve a <span className="italic text-rose-deep">data</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rose-dusty/30">
            {[
              { icon: Calendar, label: "Data", value: "22 de Agosto", sub: "Sábado" },
              { icon: Clock, label: "Horário", value: "15:30h", sub: "" },
              { icon: MapPin, label: "Local", value: "Goiânia", sub: "" },
            ].map(({ icon: Icon, label, value, sub }, i) => (
              <Reveal
                key={label}
                variant="up"
                delay={i * 120}
                className="bg-ivory p-8 sm:p-12 text-center transition-elegant hover:bg-rose-soft/30 group"
              >
                <Icon className="w-7 h-7 mx-auto mb-4 sm:mb-6 text-rose-deep group-hover:scale-110 transition-elegant" strokeWidth={1.2} />
                <p className="uppercase tracking-[0.3em] text-[10px] sm:text-xs text-sage mb-3 sm:mb-4">{label}</p>
                <p className="font-display text-2xl sm:text-3xl md:text-4xl text-foreground mb-1.5 sm:mb-2">{value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground font-light">{sub}</p>
              </Reveal>
            ))}
          </div>

          {/* ENDEREÇO COMPLETO */}
          <Reveal variant="up" className="mt-12 sm:mt-16 max-w-2xl mx-auto bg-ivory border border-rose-dusty/40 p-8 sm:p-10 text-center shadow-soft">
            <p className="uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs text-rose-deep mb-4">
              Endereço do Encontro
            </p>
            <p className="font-['Arial_Black'] text-foreground leading-snug text-lg text-center">
              SALÃO DE FESTAS · RUA T-30 Nº 1284, SETOR BUENO<br />
              RESIDENCIAL BUENO PARK · GOIÂNIA - GO.
            </p>
          </Reveal>

          {/* INSCRIÇÃO */}
          <div id="inscricao" className="mt-20 sm:mt-28 md:mt-36 max-w-2xl mx-auto scroll-mt-24">
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="font-display uppercase tracking-[0.3em] sm:tracking-[0.4em] text-3xl sm:text-4xl md:text-5xl text-rose-deep">
                Inscrição
              </h3>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-foreground/60 font-light max-w-md mx-auto">
                Preencha seus dados e venha florescer conosco.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="max-w-xl mx-auto bg-ivory border border-rose-dusty/40 p-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-rose-deep" />
                </div>
              }
            >
              <SubscriptionForm />
            </Suspense>
          </div>
        </div>
      </section>

      {/* RSVP */}
      <section id="rsvp" className="py-16 sm:py-24 md:py-32 px-5 sm:px-6 bg-ivory scroll-mt-24">
        <div className="max-w-5xl mx-auto">
          <Reveal variant="up" className="text-center mb-10 sm:mb-14">
            <p className="uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs text-rose-deep mb-4 sm:mb-6">
              RSVP
            </p>
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground">
              Confirme sua <span className="italic text-rose-deep">presença</span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-foreground/60 font-light max-w-md mx-auto">
              Nos diga se você estará conosco no 6º Encontro das Magnólias.
            </p>
          </Reveal>
          <Reveal variant="up">
            <RsvpForm />
          </Reveal>
        </div>
      </section>




      {/* INVITATION CTA */}
      <section className="relative py-20 sm:py-28 md:py-36 px-5 sm:px-6 gradient-soft overflow-hidden">
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -left-16 sm:-left-20 top-1/2 -translate-y-1/2 w-56 sm:w-80 opacity-20 sm:opacity-30 -rotate-45 pointer-events-none"
          loading="lazy"
        />
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -right-16 sm:-right-20 top-1/2 -translate-y-1/2 w-56 sm:w-80 opacity-20 sm:opacity-30 rotate-[135deg] pointer-events-none"
          loading="lazy"
        />

        <Reveal variant="up" className="relative max-w-2xl mx-auto text-center">
          <p className="uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs text-rose-deep mb-6 sm:mb-8">Convite</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-6xl text-foreground mb-8 sm:mb-10 leading-tight">
            Você está convidada
            <br />
            <span className="italic text-rose-deep">a florescer</span>
          </h2>
          <p className="text-foreground/70 text-sm sm:text-base md:text-lg leading-relaxed mb-10 sm:mb-12 font-light">
            Como a magnólia que floresce em sua estação própria, cada mulher
            tem um tempo de desabrochar. Reserve seu lugar nesta tarde de
            comunhão, adoração e palavras que cuidam.
          </p>

          <Button
            size="lg"
            onClick={() => document.getElementById("inscricao")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-none px-8 sm:px-12 py-5 sm:py-6 text-xs sm:text-sm tracking-[0.25em] sm:tracking-[0.3em] uppercase font-light transition-elegant shadow-petal"
            style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
          >
            Quero participar
          </Button>

          <p className="mt-6 sm:mt-8 text-[10px] sm:text-xs tracking-widest uppercase text-sage">
            Vagas limitadas
          </p>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="py-12 sm:py-16 px-5 sm:px-6 bg-cream border-t border-rose-dusty/30">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-display italic text-xl sm:text-2xl text-rose-deep mb-3">
            Encontro das Magnólias
          </p>
          <p className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-sage leading-relaxed">
            SEXTA EDIÇÃO · GOIÂNIA · 22 DE AGOSTO · 15:30H
          </p>
          <a
            href="/admin"
            className="mt-6 inline-block text-[10px] tracking-[0.3em] uppercase text-sage/50 hover:text-rose-deep transition-elegant"
          >
            Admin
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
