import { Link } from "@tanstack/react-router";
import { Menu, X, Instagram, Facebook, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/logo";
import { getSalonSettings } from "@/lib/booking.functions";
import { whatsappUrl } from "@/lib/time";

export function useSalonSettings() {
  return useQuery({
    queryKey: ["salon-settings"],
    queryFn: () => getSalonSettings(),
    staleTime: 60_000,
  });
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const settings = useSalonSettings();
  const s = settings.data;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
      {s && (s.phone || s.address) && (
        <div className="hidden md:block bg-primary/5 border-b border-primary/10">
          <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              {s.address && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{s.address}</span>
              )}
              {s.phone && (
                <a href={whatsappUrl(s.phone)} className="flex items-center gap-1 hover:text-foreground">
                  <MessageCircle className="h-3 w-3 text-primary" />{s.phone}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram className="h-4 w-4 hover:text-primary" /></a>}
              {s.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook className="h-4 w-4 hover:text-primary" /></a>}
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3 group">
          <BrandLogo className="h-11 w-11" />
          <span className="font-display text-2xl font-semibold tracking-tight leading-none">
            Vem Cá Menina
            <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-sans">Hair Salon</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <Link to="/" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Início</Link>
          <Link to="/agendar" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Agendar</Link>
          <Link to="/meus-agendamentos" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Meus agendamentos</Link>
          <Link to="/login">
            <Button size="sm" variant="outline">Área restrita</Button>
          </Link>
        </nav>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border/60 bg-background px-4 py-3 flex flex-col gap-2">
          <Link to="/" onClick={() => setOpen(false)} className="py-2">Início</Link>
          <Link to="/agendar" onClick={() => setOpen(false)} className="py-2">Agendar</Link>
          <Link to="/meus-agendamentos" onClick={() => setOpen(false)} className="py-2">Meus agendamentos</Link>
          <Link to="/login" onClick={() => setOpen(false)} className="py-2">Área restrita</Link>
          {s && (
            <div className="mt-2 pt-3 border-t space-y-2 text-sm text-muted-foreground">
              {s.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{s.address}</p>}
              {s.phone && <a href={whatsappUrl(s.phone)} className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" />{s.phone}</a>}
              <div className="flex gap-3 pt-1">
                {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer"><Instagram className="h-5 w-5 text-primary" /></a>}
                {s.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener noreferrer"><Facebook className="h-5 w-5 text-primary" /></a>}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const settings = useSalonSettings();
  const s = settings.data;
  return (
    <footer className="mt-24 border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <BrandLogo className="h-12 w-12" />
            <p className="font-display text-2xl">Vem Cá Menina</p>
          </div>
          <p className="text-muted-foreground">
            {s?.tagline || "Seu salão de beleza em Bragança Paulista"}. Cabelo, unhas e cuidado — com hora marcada.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-medium mb-2">Contato</p>
          {s?.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{s.address}</span>
            </a>
          )}
          {s?.phone && (
            <a href={whatsappUrl(s.phone)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <MessageCircle className="h-4 w-4 text-primary" />{s.phone}
            </a>
          )}
        </div>
        <div>
          <p className="font-medium mb-2">Redes sociais</p>
          <div className="flex gap-3">
            {s?.instagram_url && (
              <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition">
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {s?.facebook_url && (
              <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition">
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {!s?.instagram_url && !s?.facebook_url && (
              <p className="text-xs text-muted-foreground">Em breve.</p>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Vem Cá Menina — Salão de Beleza em Bragança Paulista. Todos os direitos reservados.
      </div>
    </footer>
  );
}
