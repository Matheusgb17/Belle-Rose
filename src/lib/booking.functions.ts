import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OPEN_BLOCK, CLOSE_BLOCK } from "./time";

const ADMIN_EMAIL = "adm@salao.app";
const ADMIN_DEFAULT_PASSWORD = "123";

// ---------- Public reads ----------

export const getSalonSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("salon_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
});

export const listProfessionals = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profs, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, photo_url, phone, is_active")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
  const map = new Map<string, string[]>();
  (roles ?? []).forEach((r) => {
    const arr = map.get(r.user_id) ?? [];
    arr.push(r.role);
    map.set(r.user_id, arr);
  });
  return (profs ?? [])
    .map((p) => ({ ...p, roles: map.get(p.id) ?? [] }))
    .filter((p) => p.roles.includes("hairdresser") || p.roles.includes("manicurist"));
});

export const listProcedures = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("procedures")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listActivePromotions = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("promotions")
    .select("*, promotion_procedures(procedure_id, procedures(id, name, category, duration_blocks, price))")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// ---------- Slot algorithm (multi-professional aware) ----------

export const getAvailableSlots = createServerFn({ method: "POST" })
  .inputValidator((input: { professionals: { id: string; blocks: number }[]; date: string }) =>
    z
      .object({
        professionals: z
          .array(z.object({ id: z.string().uuid(), blocks: z.number().int().min(1).max(20) }))
          .min(1)
          .max(3),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.professionals.map((p) => p.id);
    const { data: appts, error } = await supabaseAdmin
      .from("appointments")
      .select("professional_id, start_block, total_blocks")
      .in("professional_id", ids)
      .eq("scheduled_date", data.date)
      .eq("status", "confirmed");
    if (error) throw new Error(error.message);

    const busyByPro = new Map<string, Set<number>>();
    ids.forEach((id) => busyByPro.set(id, new Set()));
    (appts ?? []).forEach((a) => {
      const set = busyByPro.get(a.professional_id)!;
      for (let i = 0; i < a.total_blocks; i++) set.add(a.start_block + i);
    });

    const maxBlocks = Math.max(...data.professionals.map((p) => p.blocks));
    const now = new Date();
    const isToday = data.date === now.toISOString().slice(0, 10);
    const nowBlock = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);

    const slots: number[] = [];
    for (let s = OPEN_BLOCK; s + maxBlocks <= CLOSE_BLOCK; s++) {
      if (isToday && s <= nowBlock) continue;
      let ok = true;
      for (const p of data.professionals) {
        const busy = busyByPro.get(p.id)!;
        for (let i = 0; i < p.blocks; i++) {
          if (busy.has(s + i)) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (ok) slots.push(s);
    }
    return slots;
  });

// ---------- Booking (multi-professional) ----------

const bookingSchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().min(8).max(20),
  clientEmail: z.string().email().max(160).optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startBlock: z.number().int().min(0).max(47),
  promotionId: z.string().uuid().optional(),
  professionals: z
    .array(
      z.object({
        professionalId: z.string().uuid(),
        procedureIds: z.array(z.string().uuid()).min(1).max(10),
      }),
    )
    .min(1)
    .max(3),
});

export const createAppointment = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof bookingSchema>) => bookingSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const allProcIds = Array.from(new Set(data.professionals.flatMap((p) => p.procedureIds)));
    const { data: procs, error: pErr } = await supabaseAdmin
      .from("procedures")
      .select("id, name, price, duration_blocks, category")
      .in("id", allProcIds);
    if (pErr) throw new Error(pErr.message);
    if (!procs || procs.length !== allProcIds.length) throw new Error("Procedimento inválido");

    const procMap = new Map(procs.map((p) => [p.id, p]));

    // Compute per-pro totals
    const perPro = data.professionals.map((entry) => {
      const items = entry.procedureIds.map((id) => {
        const p = procMap.get(id)!;
        return { id: p.id, name: p.name, price: Number(p.price), blocks: p.duration_blocks };
      });
      return {
        professionalId: entry.professionalId,
        items,
        totalBlocks: items.reduce((s, i) => s + i.blocks, 0),
        totalPrice: items.reduce((s, i) => s + i.price, 0),
      };
    });

    const maxBlocks = Math.max(...perPro.map((p) => p.totalBlocks));
    if (data.startBlock + maxBlocks > CLOSE_BLOCK || data.startBlock < OPEN_BLOCK)
      throw new Error("Horário fora do expediente");

    // Re-check availability
    const ids = perPro.map((p) => p.professionalId);
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("professional_id, start_block, total_blocks")
      .in("professional_id", ids)
      .eq("scheduled_date", data.date)
      .eq("status", "confirmed");
    const busyByPro = new Map<string, Set<number>>();
    ids.forEach((id) => busyByPro.set(id, new Set()));
    (appts ?? []).forEach((a) => {
      const set = busyByPro.get(a.professional_id)!;
      for (let i = 0; i < a.total_blocks; i++) set.add(a.start_block + i);
    });
    for (const p of perPro) {
      const busy = busyByPro.get(p.professionalId)!;
      for (let i = 0; i < p.totalBlocks; i++) {
        if (busy.has(data.startBlock + i)) throw new Error("Horário não está mais disponível");
      }
    }

    // Promotion validation + price override
    let promotion: any = null;
    if (data.promotionId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: promo } = await supabaseAdmin
        .from("promotions")
        .select("*, promotion_procedures(procedure_id)")
        .eq("id", data.promotionId)
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();
      if (promo) {
        const promoProcIds = new Set((promo.promotion_procedures ?? []).map((pp: any) => pp.procedure_id));
        // Only apply if user's cart contains exactly the promo procedures
        const cartSet = new Set(allProcIds);
        const sameSize = cartSet.size === promoProcIds.size;
        const allMatch = sameSize && [...cartSet].every((id) => promoProcIds.has(id));
        if (allMatch) promotion = promo;
      }
    }

    // Upsert client
    const phone = data.clientPhone.replace(/\D/g, "");
    let clientId: string;
    const { data: existing } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (existing) {
      clientId = existing.id;
      await supabaseAdmin
        .from("clients")
        .update({ name: data.clientName, email: data.clientEmail || null })
        .eq("id", clientId);
    } else {
      const { data: ins, error: cErr } = await supabaseAdmin
        .from("clients")
        .insert({ name: data.clientName, phone, email: data.clientEmail || null })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      clientId = ins.id;
    }

    // If promo applies, distribute the promo price pro-rata by each pro's totalPrice share
    const groupId = crypto.randomUUID();
    const originalTotal = perPro.reduce((s, p) => s + p.totalPrice, 0);
    const promoTotal = promotion ? Number(promotion.promo_price) : null;

    const createdIds: string[] = [];
    for (const p of perPro) {
      const priceToUse =
        promoTotal !== null && originalTotal > 0
          ? Math.round((promoTotal * (p.totalPrice / originalTotal)) * 100) / 100
          : p.totalPrice;
      const { data: appt, error: aErr } = await supabaseAdmin
        .from("appointments")
        .insert({
          client_id: clientId,
          professional_id: p.professionalId,
          scheduled_date: data.date,
          start_block: data.startBlock,
          total_blocks: p.totalBlocks,
          total_price: priceToUse,
          status: "confirmed",
          promotion_id: promotion?.id ?? null,
          group_id: groupId,
        })
        .select("id")
        .single();
      if (aErr) throw new Error(aErr.message);
      createdIds.push(appt.id);
      await supabaseAdmin.from("appointment_items").insert(
        p.items.map((it) => ({
          appointment_id: appt.id,
          procedure_id: it.id,
          procedure_name: it.name,
          price: it.price,
          blocks: it.blocks,
        })),
      );
    }

    return {
      ids: createdIds,
      groupId,
      totalPrice: promoTotal ?? originalTotal,
      totalBlocks: maxBlocks,
      promotionApplied: !!promotion,
    };
  });

// ---------- Client lookup / cancel ----------

export const lookupAppointmentsByPhone = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().trim().min(8).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.replace(/\D/g, "");
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("phone", phone)
      .maybeSingle();
    if (!client) return { client: null, appointments: [] };

    const today = new Date().toISOString().slice(0, 10);
    const { data: appts, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, scheduled_date, start_block, total_blocks, total_price, status, group_id, professional:profiles(full_name), appointment_items(procedure_name, price)",
      )
      .eq("client_id", client.id)
      .gte("scheduled_date", today)
      .order("scheduled_date")
      .order("start_block");
    if (error) throw new Error(error.message);
    return { client, appointments: appts ?? [] };
  });

export const cancelAppointmentByPhone = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; appointmentId: string }) =>
    z
      .object({
        phone: z.string().trim().min(8).max(20),
        appointmentId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.replace(/\D/g, "");
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (!client) throw new Error("Cliente não encontrado");
    // Fetch appointment to find group
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, group_id, client_id")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appt || appt.client_id !== client.id) throw new Error("Agendamento não encontrado");
    if (appt.group_id) {
      const { error } = await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("group_id", appt.group_id)
        .eq("client_id", client.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", data.appointmentId)
        .eq("client_id", client.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Admin bootstrap ----------

export const ensureAdminUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("username", "adm")
    .maybeSingle();
  if (existing) return { email: existing.email ?? ADMIN_EMAIL };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { username: "adm" },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar admin");
  await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    username: "adm",
    full_name: "Administrador",
    email: ADMIN_EMAIL,
  });
  await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
  return { email: ADMIN_EMAIL };
});

export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) =>
    z.object({ username: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.username.includes("@")) return { email: data.username };
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("username", data.username)
      .maybeSingle();
    if (prof?.email) return { email: prof.email };
    if (data.username === "adm") return { email: ADMIN_EMAIL };
    throw new Error("Usuário não encontrado");
  });
