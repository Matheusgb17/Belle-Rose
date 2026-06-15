import { Link } from "@tanstack/react-router";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-rose shadow-soft">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">Belle Rosé</span>
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
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 text-center text-sm text-muted-foreground">
        <p className="font-display text-xl text-foreground">Belle Rosé</p>
        <p className="mt-1">Seu espaço de beleza e bem-estar.</p>
        <p className="mt-4 text-xs">© {new Date().getFullYear()} — Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
