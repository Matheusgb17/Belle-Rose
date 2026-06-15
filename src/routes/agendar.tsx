import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, ShoppingBag, Trash2, Check, User, Plus, Minus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import {
  listProfessionals,
  listProcedures,
  getAvailableSlots,
  createAppointment,
} from "@/lib/booking.functions";
import { formatBRL, blocksToDuration, blockToTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agendar")({
  head: () => ({ meta: [{ title: "Agendar — Belle Rosé" }, { name: "description", content: "Escolha sua profissional, serviços e horário." }] }),
  component: BookPage,
});

type Step = 1 | 2 | 3 | 4 | 5;

function BookPage() {
  const [step, setStep] = useState<Step>(1);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hairdresser" | "manicurist">("all");
  const [cart, setCart] = useState<string[]>([]);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startBlock, setStartBlock] = useState<number | null>(null);
  const [client, setClient] = useState({ name: "", phone: "", email: "" });

  const profs = useQuery({ queryKey: ["profs"], queryFn: () => listProfessionals() });
  const procs = useQuery({ queryKey: ["procs"], queryFn: () => listProcedures() });

  const cartProcs = useMemo(
    () => (procs.data ?? []).filter((p: any) => cart.includes(p.id)),
    [procs.data, cart],
  );
  const totalBlocks = cartProcs.reduce((s, p: any) => s + p.duration_blocks, 0);
  const totalPrice = cartProcs.reduce((s, p: any) => s + Number(p.price), 0);

  const dateStr = date ? format(date, "yyyy-MM-dd") : null;

  const slots = useQuery({
    queryKey: ["slots", professionalId, dateStr, totalBlocks],
    queryFn: () => getAvailableSlots({ data: { professionalId: professionalId!, date: dateStr!, totalBlocks } }),
    enabled: !!professionalId && !!dateStr && totalBlocks > 0 && step === 4,
  });

  const createFn = useServerFn(createAppointment);
  const submit = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clientName: client.name,
          clientPhone: client.phone,
          clientEmail: client.email || undefined,
          professionalId: professionalId!,
          date: dateStr!,
          startBlock: startBlock!,
          items: cart.map((id) => ({ procedureId: id })),
        },
      }),
    onSuccess: () => {
      toast.success("Agendamento confirmado!", { description: "Você receberá os detalhes em breve." });
      setStep(5);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao agendar"),
  });

  const visibleProfs = (profs.data ?? []).filter((p: any) =>
    filter === "all" ? true : p.roles?.includes(filter),
  );

  const toggleProc = (id: string) =>
    setCart((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const selectedProf = (profs.data ?? []).find((p: any) => p.id === professionalId);
  const groupedProcs = useMemo(() => {
    const map: Record<string, any[]> = {};
    (procs.data ?? []).forEach((p: any) => {
      map[p.category] = map[p.category] ?? [];
      map[p.category].push(p);
    });
    return map;
  }, [procs.data]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 flex-1">
        <h1 className="font-display text-4xl mb-2">Agendar horário</h1>
        <p className="text-muted-foreground mb-6">Em poucos passos.</p>

        <Stepper step={step} />

        {step === 1 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Escolha a profissional</h2>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mt-4 mb-6">
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="hairdresser">Cabelo</TabsTrigger>
                <TabsTrigger value="manicurist">Unhas</TabsTrigger>
              </TabsList>
            </Tabs>
            {profs.isLoading && <p className="text-muted-foreground">Carregando…</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleProfs.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProfessionalId(p.id);
                    setStep(2);
                  }}
                  className={cn(
                    "flex flex-col items-center p-5 rounded-xl border-2 transition-all text-center hover:shadow-soft hover:-translate-y-0.5",
                    professionalId === p.id ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <Avatar className="h-20 w-20 mb-3">
                    <AvatarImage src={p.photo_url ?? undefined} />
                    <AvatarFallback className="text-xl"><User /></AvatarFallback>
                  </Avatar>
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">
                    {p.roles.includes("hairdresser") ? "Cabeleireira" : "Manicure"}
                  </p>
                </button>
              ))}
              {!profs.isLoading && visibleProfs.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-8">
                  Nenhuma profissional cadastrada ainda. O administrador deve cadastrar profissionais.
                </p>
              )}
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Escolha os procedimentos</h2>
            <p className="text-sm text-muted-foreground mb-6">Selecione um ou mais.</p>
            {Object.entries(groupedProcs).map(([cat, items]) => (
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
            ))}
            <CartSummary count={cart.length} totalBlocks={totalBlocks} totalPrice={totalPrice} />
            <Footer>
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button disabled={cart.length === 0} onClick={() => setStep(3)} className="gap-1">
                Continuar <ChevronRight className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Resumo do carrinho</h2>
            <p className="text-sm text-muted-foreground mb-6">Confirme os serviços antes de escolher data.</p>
            <ul className="divide-y border rounded-xl mb-4">
              {cartProcs.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{blocksToDuration(p.duration_blocks)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatBRL(Number(p.price))}</span>
                    <Button size="icon" variant="ghost" onClick={() => toggleProc(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
            <CartSummary count={cart.length} totalBlocks={totalBlocks} totalPrice={totalPrice} />
            <Footer>
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button onClick={() => setStep(4)} className="gap-1">
                Escolher data <ChevronRight className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {step === 4 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl mb-1">Data e horário</h2>
            <p className="text-sm text-muted-foreground mb-6">Selecione a data e depois o horário disponível.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="mb-2 block">Data</Label>
                <div className="rounded-xl border bg-card p-2 inline-block">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setStartBlock(null); }}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">
                  Horários disponíveis {selectedProf && `— ${selectedProf.full_name}`}
                </Label>
                {!date && <p className="text-sm text-muted-foreground">Escolha uma data.</p>}
                {date && slots.isLoading && <p className="text-sm text-muted-foreground">Buscando…</p>}
                {date && slots.data && slots.data.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem horários para esta data. Tente outro dia.</p>
                )}
                {date && slots.data && slots.data.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.data.map((b: number) => (
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
                    Início: <b>{blockToTime(startBlock)}</b> • Término: <b>{blockToTime(startBlock + totalBlocks)}</b>
                  </div>
                )}
              </div>
            </div>
            <Footer>
              <Button variant="outline" onClick={() => setStep(3)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
              <Button disabled={startBlock === null} onClick={() => setStep(5)} className="gap-1">
                Seus dados <ChevronRight className="h-4 w-4" />
              </Button>
            </Footer>
          </Card>
        )}

        {step === 5 && !submit.isSuccess && (
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
            <div className="mt-6 rounded-xl bg-muted/40 p-4 text-sm">
              <p className="font-medium mb-2">Resumo</p>
              <p>Profissional: <b>{selectedProf?.full_name}</b></p>
              <p>Data: <b>{date && format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</b></p>
              <p>Horário: <b>{startBlock !== null && blockToTime(startBlock)} – {startBlock !== null && blockToTime(startBlock + totalBlocks)}</b></p>
              <p>Total: <b className="text-primary">{formatBRL(totalPrice)}</b></p>
            </div>
            <Footer>
              <Button variant="outline" onClick={() => setStep(4)}><ChevronLeft className="h-4 w-4" /> Voltar</Button>
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
              {selectedProf?.full_name} • {date && format(date, "dd/MM/yyyy")} • {startBlock !== null && blockToTime(startBlock)}
            </p>
            <p className="mt-4">Te esperamos! 💖</p>
            <div className="mt-8 flex justify-center gap-2">
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
  const labels = ["Profissional", "Serviços", "Carrinho", "Data/Hora", "Dados"];
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
              active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-primary/20 border-primary/40" : "bg-muted border-border text-muted-foreground"
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

function CartSummary({ count, totalBlocks, totalPrice }: { count: number; totalBlocks: number; totalPrice: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl gradient-rose/30 bg-primary/5 border border-primary/20 p-4 mt-2">
      <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" /><span className="text-sm">{count} {count === 1 ? "serviço" : "serviços"}</span></div>
      <span className="text-sm text-muted-foreground">{blocksToDuration(totalBlocks)}</span>
      <span className="text-lg font-semibold text-primary">{formatBRL(totalPrice)}</span>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-between gap-2">{children}</div>;
}
