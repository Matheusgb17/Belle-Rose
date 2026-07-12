import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Search, Sparkles, Scissors, Hand, Star, MapPin, MessageCircle, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader, SiteFooter, useSalonSettings } from "@/components/site-chrome";
import { listActivePromotions, listProcedures } from "@/lib/booking.functions";
import { formatBRL, blocksToDuration, whatsappUrl } from "@/lib/time";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vem Cá Menina — Salão de Beleza em Bragança Paulista" },
      { name: "description", content: "Salão de beleza em Bragança Paulista. Agende online cabelo e unhas com nossas cabeleireiras e manicures." },
      { property: "og:title", content: "Vem Cá Menina — Salão de Beleza em Bragança Paulista" },
      { property: "og:description", content: "Agende cabelo e unhas online no nosso salão em Bragança Paulista." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const promos = useQuery({ queryKey: ["home-promos"], queryFn: () => listActivePromotions() });
  const procs = useQuery({ queryKey: ["home-procs"], queryFn: () => listProcedures() });
  const settings = useSalonSettings();
  const s = settings.data;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4 px-4 py-1 text-xs tracking-widest uppercase">
              <Sparkles className="h-3 w-3 mr-1 inline" /> Bragança Paulista • SP
            </Badge>
            <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.05]">
              Vem <span className="italic text-primary">Cá</span> Menina
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              {s?.tagline || "Seu salão de beleza em Bragança Paulista"}. Agende online com nossas cabeleireiras e manicures — cabelo, unhas e cuidado, tudo no mesmo lugar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
          </div>
        </div>
      </section>

      {/* Contact Highlight */}
      <section className="mx-auto max-w-6xl px-4 -mt-6 relative z-10">
        <Card className="p-6 md:p-8 border-primary/20 shadow-elegant">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Endereço</p>
                {s?.address ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-primary block mt-0.5"
                  >
                    {s.address}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">Configure no painel.</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Telefone</p>
                {s?.phone ? (
                  <a href={`tel:${s.phone.replace(/\D/g, "")}`} className="font-medium hover:text-primary block mt-0.5">{s.phone}</a>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">Configure no painel.</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Instagram className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Redes sociais</p>
                <div className="flex gap-2 mt-1">
                  {s?.instagram_url && (
                    <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary flex items-center gap-1">
                      <Instagram className="h-4 w-4" /> Instagram
                    </a>
                  )}
                  {s?.facebook_url && (
                    <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary flex items-center gap-1">
                      <Facebook className="h-4 w-4" /> Facebook
                    </a>
                  )}
                  {!s?.instagram_url && !s?.facebook_url && (
                    <p className="text-sm text-muted-foreground">Em breve.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
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
              <p className="text-muted-foreground">Aproveite enquanto duram. Selecione direto no agendamento.</p>
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
