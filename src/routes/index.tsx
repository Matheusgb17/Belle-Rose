import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Search, Sparkles, Scissors, Hand, Star, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { listActivePromotions, listProcedures } from "@/lib/booking.functions";
import { formatBRL, blocksToDuration } from "@/lib/time";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Belle Rosé — Salão de Beleza" },
      { name: "description", content: "Agende seu horário online com nossas cabeleireiras e manicures. Cabelo, unhas e estética em um só lugar." },
      { property: "og:title", content: "Belle Rosé — Salão de Beleza" },
      { property: "og:description", content: "Agende seu horário online com nossas cabeleireiras e manicures." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const promos = useQuery({ queryKey: ["home-promos"], queryFn: () => listActivePromotions() });
  const procs = useQuery({ queryKey: ["home-procs"], queryFn: () => listProcedures() });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <Badge variant="secondary" className="mb-6 px-4 py-1 text-xs tracking-widest uppercase">
            <Sparkles className="h-3 w-3 mr-1 inline" /> Beleza & Bem-estar
          </Badge>
          <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.05] max-w-3xl">
            Sua beleza, cuidada com <span className="italic text-primary">delicadeza</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Agende online com nossas cabeleireiras e manicures. Escolha seus serviços, monte seu carrinho e receba a melhor experiência.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/agendar">
              <Button size="lg" className="rounded-full h-12 px-8 shadow-elegant gap-2">
                <Calendar className="h-4 w-4" />
                Agendar horário
              </Button>
            </Link>
            <Link to="/meus-agendamentos">
              <Button size="lg" variant="outline" className="rounded-full h-12 px-8 gap-2">
                <Search className="h-4 w-4" />
                Consultar / cancelar
              </Button>
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
            {[
              { icon: Clock, label: "Agenda inteligente", desc: "Sem conflitos de horário" },
              { icon: Star, label: "Profissionais escolhidas", desc: "Por você, no momento" },
              { icon: ShieldCheck, label: "Cancelamento fácil", desc: "Com seu telefone" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-2xl bg-card/70 backdrop-blur p-4 border border-border/60">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl md:text-4xl mb-2">Nossos serviços</h2>
        <p className="text-muted-foreground mb-8">Cabelo, unhas e muito mais — tudo com hora marcada.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Scissors, label: "Cabelo", cat: "cabelo" },
            { icon: Hand, label: "Unhas", cat: "unhas" },
            { icon: Sparkles, label: "Estética", cat: "estetica" },
            { icon: Star, label: "Outros", cat: "outros" },
          ].map((c) => {
            const count = (procs.data ?? []).filter((p: any) => p.category === c.cat).length;
            return (
              <Card key={c.cat} className="p-6 hover:shadow-soft transition-all hover:-translate-y-0.5 border-border/60">
                <c.icon className="h-7 w-7 text-primary mb-3" />
                <p className="font-display text-2xl">{c.label}</p>
                <p className="text-sm text-muted-foreground">{count} procedimentos</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Active promotions */}
      {promos.data && promos.data.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="font-display text-3xl md:text-4xl">Promoções ativas</h2>
              <p className="text-muted-foreground">Aproveite enquanto duram.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promos.data.map((p: any) => (
              <Card key={p.id} className="overflow-hidden border-border/60">
                <div className="gradient-rose h-2" />
                <div className="p-6">
                  <Badge className="mb-3">{Number(p.discount_percent).toFixed(0)}% OFF</Badge>
                  <h3 className="font-display text-2xl">{p.name}</h3>
                  {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                  <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                    {p.promotion_procedures?.map((pp: any) => (
                      <li key={pp.procedure_id}>• {pp.procedures?.name}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-muted-foreground line-through">{formatBRL(Number(p.original_price))}</span>
                    <span className="text-2xl font-semibold text-primary">{formatBRL(Number(p.promo_price))}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Procedures preview */}
      {procs.data && procs.data.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="font-display text-3xl md:text-4xl mb-6">Procedimentos</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {procs.data.slice(0, 9).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{p.category} • {blocksToDuration(p.duration_blocks)}</p>
                </div>
                <p className="font-semibold text-primary">{formatBRL(Number(p.price))}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/agendar"><Button size="lg" className="rounded-full px-8">Agendar agora</Button></Link>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
