import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { lookupAppointmentsByPhone, cancelAppointmentByPhone } from "@/lib/booking.functions";
import { blockToTime, formatBRL } from "@/lib/time";

export const Route = createFileRoute("/meus-agendamentos")({
  head: () => ({ meta: [{ title: "Meus agendamentos — Vem Cá Menina" }, { name: "description", content: "Consulte e cancele agendamentos pelo seu telefone." }] }),
  component: MyAppointmentsPage,
});

function MyAppointmentsPage() {
  const [phone, setPhone] = useState("");
  const lookupFn = useServerFn(lookupAppointmentsByPhone);
  const cancelFn = useServerFn(cancelAppointmentByPhone);

  const lookup = useMutation({
    mutationFn: (p: string) => lookupFn({ data: { phone: p } }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { phone, appointmentId: id } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado");
      lookup.mutate(phone);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 flex-1">
        <h1 className="font-display text-4xl mb-2">Meus agendamentos</h1>
        <p className="text-muted-foreground mb-6">Informe seu telefone para consultar ou cancelar.</p>

        <Card className="p-6 mb-6">
          <Label>Telefone</Label>
          <div className="flex gap-2 mt-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            <Button onClick={() => lookup.mutate(phone)} disabled={!phone || lookup.isPending} className="gap-1">
              <Search className="h-4 w-4" /> Buscar
            </Button>
          </div>
        </Card>

        {lookup.data && lookup.data.client === null && (
          <p className="text-center text-muted-foreground py-8">Nenhum agendamento encontrado para este telefone.</p>
        )}

        {lookup.data && lookup.data.client && (
          <>
            <p className="text-sm text-muted-foreground mb-3">Olá, <b>{lookup.data.client.name}</b>!</p>
            {lookup.data.appointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum agendamento futuro.</p>
            ) : (
              <div className="space-y-3">
                {lookup.data.appointments.map((a: any) => (
                  <Card key={a.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={a.status === "cancelled" ? "destructive" : "default"}>
                            {a.status === "cancelled" ? "Cancelado" : "Confirmado"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">com {a.professional?.full_name}</span>
                        </div>
                        <p className="font-display text-2xl flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" />
                          {format(new Date(a.scheduled_date + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR })} • {blockToTime(a.start_block)}
                        </p>
                        <ul className="mt-2 text-sm text-muted-foreground">
                          {a.appointment_items?.map((it: any, i: number) => (
                            <li key={i}>• {it.procedure_name}</li>
                          ))}
                        </ul>
                        <p className="mt-2 font-semibold text-primary">{formatBRL(Number(a.total_price))}</p>
                      </div>
                      {a.status === "confirmed" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("Cancelar este agendamento?")) cancel.mutate(a.id);
                          }}
                          className="gap-1"
                        >
                          <Trash2 className="h-4 w-4" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
