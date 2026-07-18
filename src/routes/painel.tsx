import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LogOut, Calendar as CalendarIcon, Users, Scissors, Tag, LayoutDashboard, Plus, Trash2, Edit, X, Settings, Clock, CalendarOff,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import {
  meRoles, dashboardStats, listAppointments, cancelAppointmentStaff,
  upsertProcedure, deleteProcedure,
  listAllProfessionals, createProfessional, toggleProfessional, deleteProfessional,
  upsertPromotion, deletePromotion, listAllPromotions,
  updateSalonSettings,
  getMySchedule, updateMySchedule, listMyDaysOff, addMyDayOff, removeMyDayOff,
} from "@/lib/admin.functions";
import { listProcedures, getSalonSettings } from "@/lib/booking.functions";
import { blockToTime, formatBRL, blocksToDuration, OPEN_BLOCK, CLOSE_BLOCK } from "@/lib/time";
import { BrandLogo } from "@/components/logo";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Painel — Vem Cá Menina" }] }),
  component: PanelPage,
});

function PanelPage() {
  const [authed, setAuthed] = useState<null | boolean>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      if (!data.session) navigate({ to: "/login" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      if (!session) navigate({ to: "/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!authed) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  return <PanelContent />;
}

function PanelContent() {
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meRoles() });
  const isAdmin = meQ.data?.roles?.includes("admin");

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-9 w-9" />
            <span className="font-display text-xl">Vem Cá Menina</span>
            <Badge variant="secondary" className="ml-2 text-xs">{isAdmin ? "Admin" : "Profissional"}</Badge>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:inline">{meQ.data?.profile?.full_name}</span>
            <Button size="sm" variant="outline" onClick={signOut} className="gap-1"><LogOut className="h-4 w-4" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 flex-1">
        <Tabs defaultValue="dash">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dash"><LayoutDashboard className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="appts"><CalendarIcon className="h-4 w-4 mr-1" />Agendamentos</TabsTrigger>
            <TabsTrigger value="myagenda"><Clock className="h-4 w-4 mr-1" />Minha agenda</TabsTrigger>
            <TabsTrigger value="procs"><Scissors className="h-4 w-4 mr-1" />Procedimentos</TabsTrigger>
            <TabsTrigger value="promos"><Tag className="h-4 w-4 mr-1" />Promoções</TabsTrigger>
            {isAdmin && <TabsTrigger value="profs"><Users className="h-4 w-4 mr-1" />Profissionais</TabsTrigger>}
            {isAdmin && <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Configurações</TabsTrigger>}
          </TabsList>

          <TabsContent value="dash" className="mt-6"><DashboardTab /></TabsContent>
          <TabsContent value="appts" className="mt-6"><AppointmentsTab isAdmin={!!isAdmin} /></TabsContent>
          <TabsContent value="myagenda" className="mt-6"><MyScheduleTab /></TabsContent>
          <TabsContent value="procs" className="mt-6"><ProceduresTab /></TabsContent>
          <TabsContent value="promos" className="mt-6"><PromotionsTab /></TabsContent>
          {isAdmin && <TabsContent value="profs" className="mt-6"><ProfessionalsTab /></TabsContent>}
          {isAdmin && <TabsContent value="settings" className="mt-6"><SettingsTab /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function DashboardTab() {
  const stats = useQuery({ queryKey: ["dash"], queryFn: () => dashboardStats() });
  const d = stats.data;
  if (!d) return <p className="text-muted-foreground">Carregando…</p>;
  const cards = [
    { label: "Hoje", value: d.todayCount, color: "text-primary" },
    { label: "Esta semana", value: d.weekCount, color: "text-foreground" },
    { label: "Este mês", value: d.monthCount, color: "text-foreground" },
    { label: "Faturamento previsto", value: formatBRL(d.revenue), color: "text-primary" },
  ];
  const colors = ["#C68B7A", "#D4A574", "#8B7355", "#A56F8C", "#C49B7B", "#7A5C5C"];
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</p>
            <p className={`mt-2 font-display text-3xl ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="font-medium mb-4">Serviços mais agendados</p>
          {d.topProcs.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.topProcs}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="oklch(0.62 0.13 22)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5">
          <p className="font-medium mb-4">Agendamentos por profissional</p>
          {d.byProfArr.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={d.byProfArr} dataKey="count" nameKey="name" outerRadius={80} label>
                  {d.byProfArr.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Appointments ---------------- */
function AppointmentsTab({ isAdmin }: { isAdmin: boolean }) {
  const [scope, setScope] = useState<"mine" | "all">(isAdmin ? "all" : "mine");
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["appts", scope], queryFn: () => listAppointments({ data: { scope } }) });
  const cancelFn = useServerFn(cancelAppointmentStaff);
  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { toast.success("Cancelado"); qc.invalidateQueries({ queryKey: ["appts"] }); },
    onError: (e: any) => toast.error(e?.message),
  });

  const grouped: Record<string, any[]> = {};
  (list.data ?? []).forEach((a: any) => {
    grouped[a.scheduled_date] = grouped[a.scheduled_date] ?? [];
    grouped[a.scheduled_date].push(a);
  });

  return (
    <div>
      {isAdmin && (
        <Tabs value={scope} onValueChange={(v) => setScope(v as any)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="mine">Meus</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {list.isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {Object.keys(grouped).length === 0 && !list.isLoading && (
        <p className="text-muted-foreground text-center py-12">Nenhum agendamento.</p>
      )}
      <div className="space-y-6">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="font-display text-xl mb-2 capitalize">
              {format(new Date(date + "T00:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {items.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={a.status === "cancelled" ? "destructive" : "default"}>
                          {a.status === "cancelled" ? "Cancelado" : "Confirmado"}
                        </Badge>
                        <span className="text-sm font-medium">{blockToTime(a.start_block)} – {blockToTime(a.start_block + a.total_blocks)}</span>
                      </div>
                      <p className="text-sm"><b>{a.client?.name}</b> • {a.client?.phone}</p>
                      <p className="text-xs text-muted-foreground">com {a.professional?.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{a.appointment_items?.map((i: any) => i.procedure_name).join(", ")}</p>
                      <p className="text-sm font-semibold text-primary mt-1">{formatBRL(Number(a.total_price))}</p>
                    </div>
                    {a.status === "confirmed" && (
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Cancelar?")) cancel.mutate(a.id); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Procedures ---------------- */
function ProceduresTab() {
  const qc = useQueryClient();
  const procs = useQuery({ queryKey: ["procs-all"], queryFn: () => listProcedures() });
  const upsertFn = useServerFn(upsertProcedure);
  const delFn = useServerFn(deleteProcedure);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["procs-all"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e?.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["procs-all"] }); },
    onError: (e: any) => toast.error(e?.message),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-2xl">Procedimentos</h2>
        <Button onClick={() => { setEditing({ name: "", category: "cabelo", price: 0, duration_blocks: 1, description: "" }); setOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(procs.data ?? []).map((p: any) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="secondary" className="text-xs capitalize">{p.category}</Badge>
                <p className="font-medium mt-2">{p.name}</p>
                <p className="text-xs text-muted-foreground">{blocksToDuration(p.duration_blocks)}</p>
                <p className="text-primary font-semibold mt-1">{formatBRL(Number(p.price))}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} procedimento</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Categoria</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cabelo">Cabelo</SelectItem>
                    <SelectItem value="unhas">Unhas</SelectItem>
                    <SelectItem value="estetica">Estética</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço padrão (R$)</Label><Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Duração (blocos de 30min)</Label><Input type="number" min={1} max={20} value={editing.duration_blocks} onChange={(e) => setEditing({ ...editing, duration_blocks: Number(e.target.value) })} /></div>
              </div>

              {editing.category === "cabelo" && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Preço varia por tamanho do cabelo</p>
                      <p className="text-xs text-muted-foreground">A cliente escolhe o tamanho no agendamento.</p>
                    </div>
                    <Switch checked={!!editing.by_length} onCheckedChange={(v) => setEditing({ ...editing, by_length: v })} />
                  </div>
                  {editing.by_length && (
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { k: "price_short", label: "Curto" },
                        { k: "price_medium", label: "Médio" },
                        { k: "price_long", label: "Longo" },
                        { k: "price_xlong", label: "Superlongo" },
                      ] as const).map((f) => (
                        <div key={f.k}>
                          <Label>{f.label} (R$)</Label>
                          <Input type="number" step="0.01" value={editing[f.k] ?? ""} onChange={(e) => setEditing({ ...editing, [f.k]: e.target.value === "" ? null : Number(e.target.value) })} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => save.mutate({
              id: editing.id, name: editing.name, category: editing.category,
              description: editing.description || undefined,
              price: Number(editing.price), duration_blocks: Number(editing.duration_blocks),
              by_length: editing.category === "cabelo" ? !!editing.by_length : false,
              price_short: editing.price_short ?? null,
              price_medium: editing.price_medium ?? null,
              price_long: editing.price_long ?? null,
              price_xlong: editing.price_xlong ?? null,
            })} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Promotions ---------------- */
function PromotionsTab() {
  const qc = useQueryClient();
  const promos = useQuery({ queryKey: ["promos-all"], queryFn: () => listAllPromotions() });
  const procs = useQuery({ queryKey: ["procs-for-promo"], queryFn: () => listProcedures() });
  const upsertFn = useServerFn(upsertPromotion);
  const delFn = useServerFn(deletePromotion);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  const save = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["promos-all"] }); setOpen(false); },
    onError: (e: any) => toast.error(e?.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["promos-all"] }); },
  });

  const selectedProcs = (procs.data ?? []).filter((p: any) => form?.procedure_ids?.includes(p.id));
  const original = selectedProcs.reduce((s: number, p: any) => s + Number(p.price), 0);
  const promoPrice = Number(form?.promo_price ?? 0);
  const discount = original > 0 ? ((original - promoPrice) / original) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-2xl">Promoções</h2>
        <Button onClick={() => { setForm({ name: "", description: "", procedure_ids: [], promo_price: 0, start_date: new Date().toISOString().slice(0, 10), end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }); setOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(promos.data ?? []).map((p: any) => (
          <Card key={p.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <Badge>{Number(p.discount_percent).toFixed(0)}% OFF</Badge>
                <p className="font-display text-xl mt-2">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.start_date} → {p.end_date}</p>
                <ul className="text-xs text-muted-foreground mt-2">
                  {p.promotion_procedures?.map((pp: any) => <li key={pp.procedure_id}>• {pp.procedures?.name}</li>)}
                </ul>
                <p className="mt-2"><span className="line-through text-muted-foreground text-sm mr-2">{formatBRL(Number(p.original_price))}</span><span className="text-primary font-semibold">{formatBRL(Number(p.promo_price))}</span></p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova promoção</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div>
                <Label>Procedimentos</Label>
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-48 overflow-y-auto border rounded p-2">
                  {(procs.data ?? []).map((p: any) => {
                    const checked = form.procedure_ids.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => {
                          setForm({ ...form, procedure_ids: checked ? form.procedure_ids.filter((i: string) => i !== p.id) : [...form.procedure_ids, p.id] });
                        }} />
                        {p.name} <span className="text-xs text-muted-foreground">({formatBRL(Number(p.price))})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                Preço original: <b>{formatBRL(original)}</b>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço promocional</Label><Input type="number" step="0.01" value={form.promo_price} onChange={(e) => setForm({ ...form, promo_price: Number(e.target.value) })} /></div>
                <div className="flex items-end"><div className="rounded-lg bg-primary/10 text-primary font-semibold p-2 w-full text-center">{discount > 0 ? `${discount.toFixed(1)}% de desconto` : "—"}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>Término</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => save.mutate({
              name: form.name, description: form.description || undefined,
              procedure_ids: form.procedure_ids, promo_price: Number(form.promo_price),
              start_date: form.start_date, end_date: form.end_date,
            })} disabled={save.isPending || !form?.procedure_ids?.length}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Professionals ---------------- */
function ProfessionalsTab() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["all-profs"], queryFn: () => listAllProfessionals() });
  const createFn = useServerFn(createProfessional);
  const toggleFn = useServerFn(toggleProfessional);
  const delFn = useServerFn(deleteProfessional);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ username: "", full_name: "", role: "hairdresser", email: "", phone: "", password: "", photo_url: "" });

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, photo_url: form.photo_url || undefined, phone: form.phone || undefined } }),
    onSuccess: () => { toast.success("Profissional criada"); qc.invalidateQueries({ queryKey: ["all-profs"] }); setOpen(false); setForm({ username: "", full_name: "", role: "hairdresser", email: "", phone: "", password: "", photo_url: "" }); },
    onError: (e: any) => toast.error(e?.message),
  });
  const toggle = useMutation({ mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }), onSuccess: () => qc.invalidateQueries({ queryKey: ["all-profs"] }) });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["all-profs"] }); } });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-2xl">Profissionais</h2>
        <Button onClick={() => setOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> Nova</Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(list.data ?? []).map((p: any) => (
          <Card key={p.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">@{p.username} • {p.email}</p>
                <Badge variant="secondary" className="mt-2 capitalize">{p.roles?.[0] === "hairdresser" ? "Cabeleireira" : "Manicure"}</Badge>
                {!p.is_active && <Badge variant="destructive" className="ml-1">Inativa</Badge>}
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: p.id, is_active: !p.is_active })}>{p.is_active ? "Desativar" : "Ativar"}</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova profissional</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Usuário (login)</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            </div>
            <div><Label>Especialidade</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hairdresser">Cabeleireira</SelectItem>
                  <SelectItem value="manicurist">Manicure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Senha</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><Label>Foto (URL — opcional)</Label><Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["salon-settings"], queryFn: () => getSalonSettings() });
  const updateFn = useServerFn(updateSalonSettings);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (settings.data && !form) {
      setForm({
        name: settings.data.name ?? "Vem Cá Menina",
        tagline: settings.data.tagline ?? "",
        address: settings.data.address ?? "",
        phone: settings.data.phone ?? "",
        whatsapp: settings.data.whatsapp ?? "",
        instagram_url: settings.data.instagram_url ?? "",
        facebook_url: settings.data.facebook_url ?? "",
      });
    }
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: (d: any) => updateFn({ data: d }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["salon-settings"] });
    },
    onError: (e: any) => toast.error(e?.message),
  });

  if (!form) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl mb-1">Configurações do salão</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Endereço, telefone e redes sociais aparecem no site inteiro e na confirmação de agendamentos.
      </p>
      <Card className="p-6 space-y-4">
        <div>
          <Label>Nome do salão</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Frase de destaque</Label>
          <Input
            value={form.tagline}
            placeholder="Seu salão de beleza em Bragança Paulista"
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </div>
        <div>
          <Label>Endereço completo</Label>
          <Textarea
            value={form.address}
            placeholder="Rua Exemplo, 123 — Centro, Bragança Paulista/SP"
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} placeholder="(11) 99999-9999" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>WhatsApp (opcional)</Label>
            <Input value={form.whatsapp} placeholder="(11) 99999-9999" onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Instagram (URL)</Label>
          <Input value={form.instagram_url} placeholder="https://instagram.com/vemcamenina" onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} />
        </div>
        <div>
          <Label>Facebook (URL)</Label>
          <Input value={form.facebook_url} placeholder="https://facebook.com/vemcamenina" onChange={(e) => setForm({ ...form, facebook_url: e.target.value })} />
        </div>
        <div className="pt-2">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function MyScheduleTab() {
  const qc = useQueryClient();
  const schedFn = useServerFn(getMySchedule);
  const updateFn = useServerFn(updateMySchedule);
  const listDaysFn = useServerFn(listMyDaysOff);
  const addDayFn = useServerFn(addMyDayOff);
  const removeDayFn = useServerFn(removeMyDayOff);

  const schedule = useQuery({ queryKey: ["my-schedule"], queryFn: () => schedFn({}) });
  const daysOff = useQuery({ queryKey: ["my-days-off"], queryFn: () => listDaysFn({}) });

  const [form, setForm] = useState<{ start_block: number; end_block: number; lunch_start_block: number | null; lunch_end_block: number | null }>({
    start_block: OPEN_BLOCK, end_block: CLOSE_BLOCK, lunch_start_block: 24, lunch_end_block: 26,
  });
  const [hasLunch, setHasLunch] = useState(true);
  const [pickDate, setPickDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (schedule.data) {
      setForm({
        start_block: schedule.data.start_block ?? OPEN_BLOCK,
        end_block: schedule.data.end_block ?? CLOSE_BLOCK,
        lunch_start_block: schedule.data.lunch_start_block,
        lunch_end_block: schedule.data.lunch_end_block,
      });
      setHasLunch(schedule.data.lunch_start_block != null);
    }
  }, [schedule.data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: {
      start_block: form.start_block,
      end_block: form.end_block,
      lunch_start_block: hasLunch ? form.lunch_start_block : null,
      lunch_end_block: hasLunch ? form.lunch_end_block : null,
    } }),
    onSuccess: () => { toast.success("Agenda atualizada"); qc.invalidateQueries({ queryKey: ["my-schedule"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const addDay = useMutation({
    mutationFn: (day: string) => addDayFn({ data: { day } }),
    onSuccess: () => { toast.success("Dia de folga registrado"); qc.invalidateQueries({ queryKey: ["my-days-off"] }); setPickDate(undefined); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const removeDay = useMutation({
    mutationFn: (id: string) => removeDayFn({ data: { id } }),
    onSuccess: () => { toast.success("Folga removida"); qc.invalidateQueries({ queryKey: ["my-days-off"] }); },
  });

  const blockOpts: number[] = [];
  for (let b = 0; b <= 48; b++) blockOpts.push(b);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="p-6">
        <h3 className="font-display text-xl mb-1 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Meu horário de trabalho</h3>
        <p className="text-sm text-muted-foreground mb-4">Defina início, fim e almoço. Só os horários dentro dessa faixa serão oferecidos às clientes.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Início</Label>
            <Select value={String(form.start_block)} onValueChange={(v) => setForm({ ...form, start_block: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{blockOpts.slice(0, 48).map((b) => <SelectItem key={b} value={String(b)}>{blockToTime(b)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fim</Label>
            <Select value={String(form.end_block)} onValueChange={(v) => setForm({ ...form, end_block: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{blockOpts.slice(1).map((b) => <SelectItem key={b} value={String(b)}>{blockToTime(b)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Tem intervalo de almoço</p>
            <p className="text-xs text-muted-foreground">Bloqueia esse período na agenda.</p>
          </div>
          <Switch checked={hasLunch} onCheckedChange={setHasLunch} />
        </div>
        {hasLunch && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <Label>Almoço — início</Label>
              <Select value={String(form.lunch_start_block ?? 24)} onValueChange={(v) => setForm({ ...form, lunch_start_block: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{blockOpts.slice(0, 48).map((b) => <SelectItem key={b} value={String(b)}>{blockToTime(b)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Almoço — fim</Label>
              <Select value={String(form.lunch_end_block ?? 26)} onValueChange={(v) => setForm({ ...form, lunch_end_block: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{blockOpts.slice(1).map((b) => <SelectItem key={b} value={String(b)}>{blockToTime(b)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4 w-full">Salvar horários</Button>
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-xl mb-1 flex items-center gap-2"><CalendarOff className="h-5 w-5 text-primary" />Dias de folga</h3>
        <p className="text-sm text-muted-foreground mb-3">Marque dias em que você não vai atender. As clientes não poderão agendar nesses dias. Agendamentos já feitos permanecem — entre em contato com a cliente para cancelar individualmente.</p>
        <UICalendar
          mode="single"
          selected={pickDate}
          onSelect={setPickDate}
          className={cn("p-3 pointer-events-auto rounded-md border")}
          disabled={(d) => d < new Date(new Date().toDateString())}
        />
        <Button className="mt-3 w-full" disabled={!pickDate || addDay.isPending} onClick={() => pickDate && addDay.mutate(pickDate.toISOString().slice(0, 10))}>
          Adicionar folga
        </Button>
        <div className="mt-4 space-y-2">
          {(daysOff.data ?? []).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-2">
              <p className="text-sm">{new Date(d.day + "T00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</p>
              <Button size="sm" variant="ghost" onClick={() => removeDay.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {(daysOff.data ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma folga futura registrada.</p>}
        </div>
      </Card>
    </div>
  );
}
