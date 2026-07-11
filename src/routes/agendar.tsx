import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronRight, ChevronLeft, ShoppingBag, Trash2, Check, User, Plus, Minus,
  Scissors, Hand, Sparkles as SparkIcon, MapPin, Phone, Tag,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SiteHeader, SiteFooter, useSalonSettings } from "@/components/site-chrome";
import {
  listProfessionals,
  listProcedures,
  listActivePromotions,
  getAvailableSlots,
  createAppointment,
} from "@/lib/booking.functions";
import { formatBRL, blocksToDuration, blockToTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agendar")({
  head: () => ({ meta: [{ title: "Agendar — Vem Cá Menina" }, { name: "description", content: "Agende cabelo e unhas online no nosso salão em Bragança Paulista." }] }),
  component: BookPage,
});

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type CategoryChoice = "cabelo" | "unhas" | "ambos";

const roleForCategory: Record<"cabelo" | "unhas", "hairdresser" | "manicurist"> = {
  cabelo: "hairdresser",
  unhas: "manicurist",
};

function BookPage() {
  const [step, setStep] = useState<Step>(1);
  const [categoryChoice, setCategoryChoice] = useState<CategoryChoice | null>(null);
  const [selectedPros, setSelectedPros] = useState<Record<"hairdresser" | "manicurist", string | null>>({
    hairdresser: null,
    manicurist: null,
  });
  const [cart, setCart] = useState<string[]>([]);
  const [appliedPromoId, setAppliedPromoId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startBlock, setStartBlock] = useState<number | null>(null);
  const [client, setClient] = useState({ name: "", phone: "", email: "" });

  const settings = useSalonSettings();
  const profs = useQuery({ queryKey: ["profs"], queryFn: () => listProfessionals() });
  const procs = useQuery({ queryKey: ["procs"], queryFn: () => listProcedures() });
  const promos = useQuery({ queryKey: ["active-promos"], queryFn: () => listActivePromotions() });

  const activeCategories: ("cabelo" | "unhas")[] =
    categoryChoice === "ambos" ? ["cabelo", "unhas"] : categoryChoice ? [categoryChoice] : [];

  // Procedures available given the category filter (broader "cabelo" includes "estetica" for hairdresser? keep strict)
  const availableProcs = useMemo(() => {
    if (!procs.data) return [];
    return procs.data.filter((p: any) => activeCategories.includes(p.category as any));
  }, [procs.data, activeCategories]);

  const cartProcs = useMemo(
    () => (procs.data ?? []).filter((p: any) => cart.includes(p.id)),
    [procs.data, cart],
  );

  // Map procedures to their assigned professional based on category
  const proAssignments = useMemo(() => {
    const map = new Map<"hairdresser" | "manicurist", { id: string; blocks: number; procs: any[] }>();
    for (const p of cartProcs) {
      const cat = p.category as "cabelo" | "unhas";
      const role = roleForCategory[cat];
      const proId = selectedPros[role];
      if (!proId) continue;
      const entry = map.get(role) ?? { id: proId, blocks: 0, procs: [] };
      entry.procs.push(p);
      entry.blocks += p.duration_blocks;
      map.set(role, entry);
    }
    return Array.from(map.values());
  }, [cartProcs, selectedPros]);

  const originalTotal = cartProcs.reduce((s, p: any) => s + Number(p.price), 0);
  const activePromo = appliedPromoId ? (promos.data ?? []).find((p: any) => p.id === appliedPromoId) : null;
  const finalTotal = activePromo ? Number(activePromo.promo_price) : originalTotal;
  const maxBlocks = proAssignments.length ? Math.max(...proAssignments.map((p) => p.blocks)) : 0;

  const dateStr = date ? format(date, "yyyy-MM-dd") : null;

  const slotsQuery = useQuery({
    queryKey: ["slots", dateStr, proAssignments.map((p) => `${p.id}:${p.blocks}`).join(",")],
    queryFn: () =>
      getAvailableSlots({
        data: {
          date: dateStr!,
          professionals: proAssignments.map((p) => ({ id: p.id, blocks: p.blocks })),
        },
      }),
    enabled: !!dateStr && proAssignments.length > 0 && step === 5,
  });

  const createFn = useServerFn(createAppointment);
  const submit = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clientName: client.name,
          clientPhone: client.phone,
          clientEmail: client.email || undefined,
          date: dateStr!,
          startBlock: startBlock!,
          promotionId: appliedPromoId ?? undefined,
          professionals: proAssignments.map((p) => ({
            professionalId: p.id,
            procedureIds: p.procs.map((x: any) => x.id),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Agendamento confirmado!", { description: "Você receberá os detalhes em breve." });
      setStep(6);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao agendar"),
  });

  const visiblePros = (profs.data ?? []).filter((p: any) =>
    activeCategories.some((c) => p.roles?.includes(roleForCategory[c])),
  );

  const toggleProc = (id: string) => {
    setCart((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    // Any manual cart change invalidates promo
    setAppliedPromoId(null);
  };

  const applyPromo = (promo: any) => {
    // Verify all promo procedures are compatible with active categories
    const procList = (promo.promotion_procedures ?? []).map((pp: any) => pp.procedures).filter(Boolean);
    const cats = new Set<string>(procList.map((p: any) => p.category));
    for (const c of cats) {
      if (!activeCategories.includes(c as any)) {
        toast.error(`Esta promoção inclui ${c}. Ajuste a seleção inicial para incluir.`);
        return;
      }
      const role = roleForCategory[c as "cabelo" | "unhas"];
      if (!selectedPros[role]) {
        toast.error(`Selecione um profissional de ${c === "cabelo" ? "cabelo" : "unhas"} primeiro.`);
        return;
      }
    }
    const ids = procList.map((p: any) => p.id);
    setCart(ids);
    setAppliedPromoId(promo.id);
    toast.success(`Promoção "${promo.name}" aplicada!`);
  };

  const selectedProNames = proAssignments
    .map((p) => (profs.data ?? []).find((x: any) => x.id === p.id)?.full_name)
    .filter(Boolean)
    .join(" e ");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 flex-1">
        <h1 className="font-display text-4xl mb-2">Agendar horário</h1>
        <p className="text-muted-foreground mb-6">Em poucos passos, no seu salão de beleza em Bragança Paulista.</p>

        <Stepper step={step} />

        {/* Step 1 — Category */}
        {step === 1 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">O que você quer fazer?</h2>
            <p className="text-sm text-muted-foreground mb-6">Escolha o tipo de atendimento.</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {(
                [
                  { key: "cabelo", label: "Cabelo", icon: Scissors, desc: "Corte, coloração, tratamentos" },
                  { key: "unhas", label: "Unhas", icon: Hand, desc: "Manicure, pedicure, alongamento" },
                  { key: "ambos", label: "Cabelo e Unhas", icon: SparkIcon, desc: "Atendimento completo" },
                ] as { key: CategoryChoice; label: string; icon: any; desc: string }[]
              ).map((c) => (
                <button
                  key={c.key}
                  onClick={() => {
                    setCategoryChoice(c.key);
                    setSelectedPros({ hairdresser: null, manicurist: null });
                    setCart([]);
                    setAppliedPromoId(null);
                    setStep(2);
                  }}
                  className={cn(
                    "p-6 rounded-xl border-2 text-left transition-all hover:shadow-soft hover:-translate-y-0.5",
                    categoryChoice === c.key ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <p className="font-display text-xl">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Step 2 — Professionals */}
        {step === 2 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Escolha a profissional</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {categoryChoice === "ambos" ? "Uma cabeleireira e uma manicure." : "Uma profissional."}
            </p>

            {activeCategories.map((cat) => {
              const role = roleForCategory[cat];
              const options = (profs.data ?? []).filter((p: any) => p.roles?.includes(role));
              return (
                <div key={cat} className="mb-6">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    {cat === "cabelo" ? "Cabeleireira" : "Manicure"}
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {options.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSelectedPros((prev) => ({
                            ...prev,
                            [role]: prev[role] === p.id ? null : p.id,
                          }))
                        }
                        className={cn(
                          "flex flex-col items-center p-5 rounded-xl border-2 transition-all text-center hover:shadow-soft hover:-translate-y-0.5",
                          selectedPros[role] === p.id ? "border-primary bg-primary/5" : "border-border",
                        )}
                      >
                        <Avatar className="h-16 w-16 mb-3">
                          <AvatarImage src={p.photo_url ?? undefined} />
                          <AvatarFallback className="text-lg"><User /></AvatarFallback>
                        </Avatar>
                        <p className="font-medium">{p.full_name}</p>
                      </button>
                    ))}
                    {options.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-full">
                        Nenhuma {cat === "cabelo" ? "cabeleireira" : "manicure"} disponível ainda.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            <Footer>
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button
                disabled={activeCategories.some((c) => !selectedPros[roleForCategory[c]])}
                onClick={() => { setCart([]); setAppliedPromoId(null); setStep(3); }}
                className="gap-1"
              >
                Continuar <ChevronRight className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {/* Step 3 — Procedures (with promo buttons) */}
        {step === 3 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Escolha os procedimentos</h2>
            <p className="text-sm text-muted-foreground mb-4">Selecione um ou mais. Ou aproveite uma promoção ativa abaixo.</p>

            {/* Promo highlight */}
            {promos.data && promos.data.length > 0 && (
              <div className="mb-6 -mx-2">
                <p className="text-xs uppercase tracking-widest text-primary mb-2 px-2 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Promoções ativas
                </p>
                <div className="flex gap-3 overflow-x-auto px-2 pb-2">
                  {promos.data.map((promo: any) => {
                    const isApplied = appliedPromoId === promo.id;
                    return (
                      <button
                        key={promo.id}
                        onClick={() => applyPromo(promo)}
                        className={cn(
                          "shrink-0 w-64 text-left rounded-xl border-2 p-4 transition gradient-rose bg-primary/5",
                          isApplied ? "border-primary shadow-elegant" : "border-primary/30 hover:border-primary",
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <Badge className="bg-primary text-primary-foreground">{Number(promo.discount_percent).toFixed(0)}% OFF</Badge>
                          {isApplied && <Check className="h-5 w-5 text-primary" />}
                        </div>
                        <p className="font-display text-lg leading-tight">{promo.name}</p>
                        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {promo.promotion_procedures?.slice(0, 3).map((pp: any) => (
                            <li key={pp.procedure_id}>• {pp.procedures?.name}</li>
                          ))}
                        </ul>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground line-through">{formatBRL(Number(promo.original_price))}</span>
                          <span className="font-semibold text-primary">{formatBRL(Number(promo.promo_price))}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeCategories.map((cat) => {
              const items = availableProcs.filter((p: any) => p.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-6">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{cat}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {items.map((p: any) => {
                      const selected = cart.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleProc(p.id)}
                          className={cn(
                            "text-left p-4 rounded-xl border-2 transition flex items-center justify-between gap-3",
                            selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{blocksToDuration(p.duration_blocks)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-primary">{formatBRL(Number(p.price))}</p>
                            {selected ? <Minus className="h-4 w-4 ml-auto text-primary" /> : <Plus className="h-4 w-4 ml-auto text-muted-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <CartSummary count={cart.length} maxBlocks={maxBlocks} finalTotal={finalTotal} originalTotal={originalTotal} promo={!!activePromo} />
            <Footer>
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button disabled={cart.length === 0} onClick={() => setStep(4)} className="gap-1">
                Continuar <ChevronRight className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {/* Step 4 — Cart summary */}
        {step === 4 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Resumo do carrinho</h2>
            <p className="text-sm text-muted-foreground mb-6">Confira antes de escolher a data.</p>
            {proAssignments.map((entry) => {
              const pro = (profs.data ?? []).find((x: any) => x.id === entry.id);
              return (
                <div key={entry.id} className="mb-4 rounded-xl border p-4">
                  <p className="text-sm font-medium mb-2">com <b>{pro?.full_name}</b> — {blocksToDuration(entry.blocks)}</p>
                  <ul className="divide-y">
                    {entry.procs.map((p: any) => (
                      <li key={p.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{blocksToDuration(p.duration_blocks)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatBRL(Number(p.price))}</span>
                          <Button size="icon" variant="ghost" onClick={() => toggleProc(p.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <CartSummary count={cart.length} maxBlocks={maxBlocks} finalTotal={finalTotal} originalTotal={originalTotal} promo={!!activePromo} />
            <Footer>
              <Button variant="outline" onClick={() => setStep(3)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button disabled={cart.length === 0} onClick={() => setStep(5)} className="gap-1">
                Escolher data <ChevronRight className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {/* Step 5 — Date/time */}
        {step === 5 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Data e horário</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {proAssignments.length > 1
                ? "Você e as profissionais começam no mesmo horário; a duração total é o serviço mais longo."
                : "Selecione a data e depois o horário disponível."}
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="mb-2 block">Data</Label>
                <div className="rounded-xl border bg-card p-2 inline-block">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setStartBlock(null); }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Horários — {selectedProNames}</Label>
                {!date && <p className="text-sm text-muted-foreground">Escolha uma data.</p>}
                {date && slotsQuery.isLoading && <p className="text-sm text-muted-foreground">Buscando…</p>}
                {date && slotsQuery.data && slotsQuery.data.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem horários para esta data. Tente outro dia.</p>
                )}
                {date && slotsQuery.data && slotsQuery.data.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {slotsQuery.data.map((b: number) => (
                      <button
                        key={b}
                        onClick={() => setStartBlock(b)}
                        className={cn(
                          "py-2 rounded-lg border-2 text-sm font-medium transition",
                          startBlock === b ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40",
                        )}
                      >
                        {blockToTime(b)}
                      </button>
                    ))}
                  </div>
                )}
                {startBlock !== null && (
                  <div className="mt-4 rounded-lg bg-primary/5 p-3 text-sm">
                    Início: <b>{blockToTime(startBlock)}</b> • Término: <b>{blockToTime(startBlock + maxBlocks)}</b>
                  </div>
                )}
              </div>
            </div>
            <Footer>
              <Button variant="outline" onClick={() => setStep(4)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button disabled={startBlock === null} onClick={() => setStep(6)} className="gap-1">
                Seus dados <ChevronRight className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {/* Step 6 — Client data & confirmation */}
        {step === 6 && !submit.isSuccess && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Seus dados</h2>
            <p className="text-sm text-muted-foreground mb-6">Para confirmar o agendamento.</p>
            <div className="grid gap-4 max-w-md">
              <div>
                <Label>Nome completo</Label>
                <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
              </div>
              <div>
                <Label>Telefone (WhatsApp)</Label>
                <Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <Label>E-mail (opcional)</Label>
                <Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-muted/40 p-4 text-sm space-y-1">
              <p className="font-medium mb-2">Resumo</p>
              <p>Profissionais: <b>{selectedProNames}</b></p>
              <p>Data: <b>{date && format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</b></p>
              <p>Horário: <b>{startBlock !== null && blockToTime(startBlock)} – {startBlock !== null && blockToTime(startBlock + maxBlocks)}</b></p>
              {activePromo && <p className="text-primary">Promoção: <b>{activePromo.name}</b></p>}
              <p>Total: <b className="text-primary">{formatBRL(finalTotal)}</b></p>
            </div>
            <Footer>
              <Button variant="outline" onClick={() => setStep(5)}><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button
                disabled={!client.name || !client.phone || submit.isPending}
                onClick={() => submit.mutate()}
                className="gap-1"
              >
                {submit.isPending ? "Confirmando…" : "Confirmar agendamento"}
                <Check className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {submit.isSuccess && (
          <Card className="p-10 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-3xl">Agendamento confirmado!</h2>
            <p className="text-muted-foreground mt-2">
              {selectedProNames} • {date && format(date, "dd/MM/yyyy")} • {startBlock !== null && blockToTime(startBlock)}
            </p>
            <p className="text-lg font-semibold text-primary mt-1">{formatBRL(finalTotal)}</p>

            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left text-sm max-w-md mx-auto space-y-2">
              <p className="font-medium text-center">Estamos te esperando no salão 💖</p>
              {settings.data?.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(settings.data.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 hover:text-primary"
                >
                  <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{settings.data.address}</span>
                </a>
              )}
              {settings.data?.phone && (
                <a href={`tel:${settings.data.phone.replace(/\D/g, "")}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="h-4 w-4 text-primary" /> {settings.data.phone}
                </a>
              )}
            </div>

            <div className="mt-6 flex justify-center gap-2 flex-wrap">
              <Button onClick={() => window.location.assign("/")} variant="outline">Voltar ao início</Button>
              <Button onClick={() => window.location.assign("/meus-agendamentos")}>Meus agendamentos</Button>
            </div>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Tipo", "Profissional", "Serviços", "Carrinho", "Data/Hora", "Dados"];
  return (
    <div className="flex items-center gap-2 mb-8 overflow-x-auto">
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <div key={l} className="flex items-center gap-2 shrink-0">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border-2",
              active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-primary/20 border-primary/40" : "bg-muted border-border text-muted-foreground",
            )}>
              {done ? <Check className="h-4 w-4" /> : n}
            </div>
            <span className={cn("text-sm", active ? "font-medium" : "text-muted-foreground")}>{l}</span>
            {i < labels.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

function CartSummary({
  count, maxBlocks, finalTotal, originalTotal, promo,
}: { count: number; maxBlocks: number; finalTotal: number; originalTotal: number; promo: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4 mt-2">
      <div className="flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 text-primary" />
        <span className="text-sm">{count} {count === 1 ? "serviço" : "serviços"}</span>
      </div>
      <span className="text-sm text-muted-foreground">{blocksToDuration(maxBlocks)}</span>
      <div className="text-right">
        {promo && originalTotal > 0 && (
          <span className="text-xs text-muted-foreground line-through mr-2">{formatBRL(originalTotal)}</span>
        )}
        <span className="text-lg font-semibold text-primary">{formatBRL(finalTotal)}</span>
      </div>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-between gap-2">{children}</div>;
}
