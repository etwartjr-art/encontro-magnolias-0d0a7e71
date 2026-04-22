import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";
import bannerImage from "@/assets/magnolia-banner.png";
import grupoImage from "@/assets/magnolias-grupo.jpeg";
import branchImage from "@/assets/magnolia-branch.png";
import { SubscriptionForm } from "@/components/SubscriptionForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-ivory text-foreground overflow-x-hidden">
      {/* HERO BANNER */}
      <header className="relative w-full">
        <img
          src={bannerImage}
          alt="3º Encontro das Magnólias"
          className="w-full h-auto object-cover"
        />
      </header>

      {/* INTRO */}
      <section className="py-20 md:py-28 px-6 gradient-soft">
        <div className="max-w-2xl mx-auto text-center animate-fade-up">
          <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-6">
            Mulheres que florescem na presença de Deus
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="h-px w-12 bg-rose-dusty" />
            <span className="font-display italic text-rose-dusty text-lg">terceira edição</span>
            <span className="h-px w-12 bg-rose-dusty" />
          </div>

          <h1 className="font-display text-4xl md:text-5xl text-foreground/90 leading-tight mb-8">
            Com grande alegria,
            <br />
            <span className="italic text-rose-deep">convidamos você</span>
          </h1>

          <p className="text-foreground/70 text-base md:text-lg leading-relaxed font-light">
            Para o nosso terceiro encontro, um momento preparado com muito{" "}
            <span className="italic text-rose-deep">amor, fé e propósito</span>.
            Um tempo para mulheres que desejam crescer em Deus, fortalecer
            laços e viver o extraordinário dEle.
          </p>
        </div>
      </section>

      {/* VERSE */}
      <section className="relative py-28 md:py-36 px-6 bg-ivory overflow-hidden">
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -left-16 top-10 w-56 opacity-40 -rotate-12 animate-float"
          loading="lazy"
        />
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -right-16 bottom-10 w-56 opacity-40 rotate-[200deg] animate-float"
          loading="lazy"
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-block mb-10">
            <div className="w-16 h-px bg-rose-dusty mx-auto mb-6" />
            <p className="uppercase tracking-[0.4em] text-xs text-rose-deep">Salmos 1:3</p>
            <div className="w-16 h-px bg-rose-dusty mx-auto mt-6" />
          </div>

          <blockquote className="font-display italic text-2xl md:text-4xl lg:text-5xl leading-relaxed text-foreground/85">
            "Pois será como a árvore plantada
            <br className="hidden md:block" />
            junto a ribeiros de águas,
            <br className="hidden md:block" />
            a qual dá o seu fruto na estação própria,
            <br className="hidden md:block" />
            <span className="text-rose-deep">e cujas folhas não caem;</span>
            <br className="hidden md:block" />
            e tudo quanto fizer prosperará."
          </blockquote>
        </div>
      </section>

      {/* DETAILS */}
      <section className="py-24 md:py-32 px-6 bg-cream">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-6">O Encontro</p>
            <h2 className="font-display text-5xl md:text-6xl text-foreground">
              Reserve a <span className="italic text-rose-deep">data</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-rose-dusty/30">
            {[
              { icon: Calendar, label: "Data", value: "23 de Maio", sub: "Sexta-feira" },
              { icon: Clock, label: "Horário", value: "15:30h", sub: "Recepção a partir das 15h" },
              { icon: MapPin, label: "Local", value: "Goiânia", sub: "Endereço enviado após inscrição" },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div
                key={label}
                className="bg-ivory p-12 text-center transition-elegant hover:bg-rose-soft/30 group"
              >
                <Icon className="w-7 h-7 mx-auto mb-6 text-rose-deep group-hover:scale-110 transition-elegant" strokeWidth={1.2} />
                <p className="uppercase tracking-[0.3em] text-xs text-sage mb-4">{label}</p>
                <p className="font-display text-3xl md:text-4xl text-foreground mb-2">{value}</p>
                <p className="text-sm text-muted-foreground font-light">{sub}</p>
              </div>
            ))}
          </div>

          {/* INSCRIÇÃO */}
          <div className="mt-24 md:mt-32">
            <div className="text-center mb-12">
              <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-6">Inscrição</p>
              <h3 className="font-display text-4xl md:text-5xl text-foreground">
                Garanta sua <span className="italic text-rose-deep">vaga</span>
              </h3>
              <p className="mt-4 text-foreground/60 font-light max-w-md mx-auto">
                Preencha seus dados e venha florescer conosco.
              </p>
            </div>
            <SubscriptionForm />
          </div>
        </div>
      </section>

      {/* GRUPO PHOTO */}
      <section className="py-24 md:py-32 px-6 bg-ivory">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-rose-soft/40 -z-10" />
            <img
              src={grupoImage}
              alt="Mulheres do grupo Magnólias"
              className="w-full h-auto object-cover shadow-petal"
              loading="lazy"
            />
          </div>

          <div>
            <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-6">Magnólias</p>
            <h2 className="font-display text-4xl md:text-5xl text-foreground mb-8 leading-tight">
              Mulheres que florescem na <span className="italic text-rose-deep">presença de Deus</span>
            </h2>
            <p className="text-foreground/70 text-base md:text-lg leading-relaxed font-light mb-6">
              Venha fazer parte desse momento especial.
            </p>
            <p className="font-display italic text-2xl md:text-3xl text-rose-deep leading-snug">
              Você é preciosa, escolhida e chamada para florescer.
            </p>
          </div>
        </div>
      </section>

      {/* INVITATION CTA */}
      <section className="relative py-28 md:py-36 px-6 gradient-soft overflow-hidden">
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -left-20 top-1/2 -translate-y-1/2 w-80 opacity-30 -rotate-45"
          loading="lazy"
        />
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -right-20 top-1/2 -translate-y-1/2 w-80 opacity-30 rotate-[135deg]"
          loading="lazy"
        />

        <div className="relative max-w-2xl mx-auto text-center">
          <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-8">Convite</p>
          <h2 className="font-display text-4xl md:text-6xl text-foreground mb-10 leading-tight">
            Você está convidada
            <br />
            <span className="italic text-rose-deep">a florescer</span>
          </h2>
          <p className="text-foreground/70 text-base md:text-lg leading-relaxed mb-12 font-light">
            Como a magnólia que floresce em sua estação própria, cada mulher
            tem um tempo de desabrochar. Reserve seu lugar nesta tarde de
            comunhão, adoração e palavras que cuidam.
          </p>

          <Button
            size="lg"
            className="rounded-none px-12 py-6 text-sm tracking-[0.3em] uppercase font-light transition-elegant shadow-petal"
            style={{ backgroundColor: "hsl(var(--rose-deep))", color: "hsl(var(--primary-foreground))" }}
          >
            Quero participar
          </Button>

          <p className="mt-8 text-xs tracking-widest uppercase text-sage">
            Vagas limitadas
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 px-6 bg-cream border-t border-rose-dusty/30">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-display italic text-2xl text-rose-deep mb-3">
            Encontro das Magnólias
          </p>
          <p className="text-xs tracking-[0.3em] uppercase text-sage">
            Terceira Edição · Goiânia · 23 de Maio · 15:30h
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
