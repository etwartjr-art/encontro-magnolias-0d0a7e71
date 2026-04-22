import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";
import heroImage from "@/assets/magnolia-hero.jpg";
import branchImage from "@/assets/magnolia-branch.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-ivory text-foreground overflow-x-hidden">
      {/* HERO */}
      <header className="relative min-h-screen flex flex-col items-center justify-center px-6 py-16 gradient-soft">
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute top-0 left-0 w-48 md:w-72 opacity-70 -translate-x-10 -translate-y-6 animate-float"
        />
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute bottom-0 right-0 w-48 md:w-72 opacity-70 translate-x-10 translate-y-6 rotate-180 animate-float"
        />

        <div className="relative z-10 max-w-3xl text-center animate-fade-up">
          <p className="uppercase tracking-[0.4em] text-xs md:text-sm text-rose-deep mb-8">
            Um encontro para mulheres
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="h-px w-12 bg-rose-dusty" />
            <span className="font-display italic text-rose-dusty text-lg">terceira edição</span>
            <span className="h-px w-12 bg-rose-dusty" />
          </div>

          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-[0.95] text-rose-deep mb-2">
            Encontro
          </h1>
          <h2 className="font-display italic text-4xl md:text-6xl lg:text-7xl text-foreground/80 mb-10">
            das Magnólias
          </h2>

          <p className="max-w-xl mx-auto text-foreground/70 text-base md:text-lg leading-relaxed mb-12 font-light">
            Uma tarde dedicada ao florescer da alma — entre conversas suaves,
            comunhão e a beleza de pertencer a um jardim que se cuida.
          </p>

          <Button
            size="lg"
            className="bg-rose-deep hover:bg-rose-deep/90 text-primary-foreground rounded-none px-12 py-6 text-sm tracking-[0.3em] uppercase font-light transition-elegant shadow-petal"
            style={{ backgroundColor: "hsl(var(--rose-deep))" }}
          >
            Garantir meu lugar
          </Button>

          <div className="mt-16 flex items-center justify-center gap-2 text-sage">
            <span className="h-px w-8 bg-sage/50" />
            <span className="text-xs tracking-widest uppercase">Goiânia · 2025</span>
            <span className="h-px w-8 bg-sage/50" />
          </div>
        </div>
      </header>

      {/* VERSE */}
      <section className="relative py-28 md:py-40 px-6 bg-ivory">
        <div className="max-w-3xl mx-auto text-center">
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

      {/* HERO IMAGE BAND */}
      <section className="relative h-[60vh] md:h-[80vh] overflow-hidden">
        <img
          src={heroImage}
          alt="Flores de magnólia em aquarela"
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1200}
          loading="lazy"
        />
        <div className="absolute inset-0 gradient-veil" />
        <div className="absolute inset-0 flex items-end justify-center pb-16 px-6">
          <p className="font-display italic text-2xl md:text-4xl text-rose-deep text-center max-w-2xl">
            "como flores que se abrem ao tempo certo"
          </p>
        </div>
      </section>

      {/* DETAILS */}
      <section className="py-28 md:py-40 px-6 bg-cream">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="uppercase tracking-[0.4em] text-xs text-rose-deep mb-6">O Encontro</p>
            <h2 className="font-display text-5xl md:text-7xl text-foreground">
              Reserve a <span className="italic text-rose-deep">data</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-rose-dusty/30">
            {[
              { icon: Calendar, label: "Data", value: "22 de Maio", sub: "Quinta-feira" },
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
        </div>
      </section>

      {/* INVITATION */}
      <section className="relative py-28 md:py-40 px-6 bg-ivory overflow-hidden">
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -left-20 top-1/2 -translate-y-1/2 w-80 opacity-30 -rotate-45"
        />
        <img
          src={branchImage}
          alt=""
          aria-hidden="true"
          className="absolute -right-20 top-1/2 -translate-y-1/2 w-80 opacity-30 rotate-[135deg]"
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
            tem um tempo de desabrochar. Venha viver essa tarde de comunhão,
            adoração e palavras que cuidam.
          </p>

          <Button
            size="lg"
            className="bg-rose-deep hover:bg-rose-deep/90 rounded-none px-12 py-6 text-sm tracking-[0.3em] uppercase font-light transition-elegant shadow-petal"
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
            Terceira Edição · Goiânia · Maio 2025
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
