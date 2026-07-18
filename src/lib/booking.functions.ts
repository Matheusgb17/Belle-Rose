import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OPEN_BLOCK, CLOSE_BLOCK } from "./time";

const ADMIN_EMAIL = "admin@salao.app";
const ADMIN_USERNAME = "admin";
const ADMIN_DEFAULT_PASSWORD = "Adm.vcm@123!";

export type HairLength = "short" | "medium" | "long" | "xlong";

function priceForProc(p: any, hairLength?: HairLength | null): number {
  if (p.category === "cabelo" && p.by_length && hairLength) {
    const map: Record<HairLength, string> = {
      short: "price_short",
      medium: "price_medium",
      long: "price_long",
      xlong: "price_xlong",
    };
    const v = p[map[hairLength]];
    if (v != null) return Number(v);
  }
  return Number(p.price);
}

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
    .select("*, promotion_procedures(procedure_id, procedures(id, name, category, duration_blocks, price, by_length, price_short, price_medium, price_long, price_xlong))")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// ---------- Availability helpers ----------

async function loadProContext(ids: string[], date: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: appts }, { data: schedules }, { data: daysOff }] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("professional_id, start_block, total_blocks")
      .in("professional_id", ids)
      .eq("scheduled_date", date)
      .eq("status", "confirmed"),
    supabaseAdmin.from("professional_schedules").select("*").in("user_id", ids),
    supabaseAdmin.from("professional_days_off").select("user_id, day").in("user_id", ids).eq("day", date),
  ]);
  const schedMap = new Map<string, any>();
  (schedules ?? []).forEach((s) => schedMap.set(s.user_id, s));
  const dayOffSet = new Set<string>((daysOff ?? []).map((d) => d.user_id));
  const busyByPro = new Map<string, Set<number>>();
  ids.forEach((id) => busyByPro.set(id, new Set()));
  (appts ?? []).forEach((a) => {
    const set = busyByPro.get(a.professional_id)!;
    for (let i = 0; i < a.total_blocks; i++) set.add(a.start_block + i);
  });
  return { busyByPro, schedMap, dayOffSet };
}

function proWindow(sched: any | undefined) {
  const start = sched?.start_block ?? OPEN_BLOCK;
  const end = sched?.end_block ?? CLOSE_BLOCK;
  const lunchStart = sched?.lunch_start_block ?? null;
  const lunchEnd = sched?.lunch_end_block ?? null;
  return { start, end, lunchStart, lunchEnd };
}

function isValidStart(
  s: number,
  blocks: number,
  window: ReturnType<typeof proWindow>,
  busy: Set<number>,
) {
  if (s < window.start || s + blocks > window.end) return false;
  for (let i = 0; i < blocks; i++) {
    const b = s + i;
    if (busy.has(b)) return false;
    if (window.lunchStart != null && window.lunchEnd != null && b >= window.lunchStart && b < window.lunchEnd) return false;
  }
  return true;
}

// ---------- Slot algorithm ----------

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
    const ids = data.professionals.map((p) => p.id);
    const { busyByPro, schedMap, dayOffSet } = await loadProContext(ids, data.date);

    const now = new Date();
    const isToday = data.date === now.toISOString().slice(0, 10);
    const nowBlock = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);

    const slots: number[] = [];
    for (let s = 0; s + 1 < 48; s++) {
      if (isToday && s <= nowBlock) continue;
      let ok = true;
      for (const p of data.professionals) {
        if (dayOffSet.has(p.id)) { ok = false; break; }
        const w = proWindow(schedMap.get(p.id));
        if (!isValidStart(s, p.blocks, w, busyByPro.get(p.id)!)) { ok = false; break; }
      }
      if (ok) slots.push(s);
    }
    return slots;
  });

export const getDaySchedules = createServerFn({ method: "POST" })
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
    const ids = data.professionals.map((p) => p.id);
    const { busyByPro, schedMap, dayOffSet } = await loadProContext(ids, data.date);

    const now = new Date();
    const isToday = data.date === now.toISOString().slice(0, 10);
    const nowBlock = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);

    return data.professionals.map((p) => {
      const w = proWindow(schedMap.get(p.id));
      const busy = busyByPro.get(p.id)!;
      const dayOff = dayOffSet.has(p.id);
      const available: number[] = [];
      if (!dayOff) {
        for (let s = w.start; s + p.blocks <= w.end; s++) {
          if (isToday && s <= nowBlock) continue;
          if (isValidStart(s, p.blocks, w, busy)) available.push(s);
        }
      }
      // Merge lunch blocks into "busy" for display purposes.
      const displayBusy = new Set<number>(busy);
      if (w.lunchStart != null && w.lunchEnd != null) {
        for (let b = w.lunchStart; b < w.lunchEnd; b++) displayBusy.add(b);
      }
      return {
        id: p.id,
        blocks: p.blocks,
        window: w,
        dayOff,
        busy: Array.from(displayBusy).sort((a, b) => a - b),
        available,
      };
    });
  });

// ---------- Booking ----------

const bookingSchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().min(8).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  promotionId: z.string().uuid().optional(),
  hairLength: z.enum(["short", "medium", "long", "xlong"]).optional(),
  professionals: z
    .array(
      z.object({
        professionalId: z.string().uuid(),
        role: z.enum(["hairdresser", "manicurist"]),
        procedureIds: z.array(z.string().uuid()).min(1).max(10),
        startBlock: z.number().int().min(0).max(47),
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
      .select("id, name, price, duration_blocks, category, by_length, price_short, price_medium, price_long, price_xlong")
      .in("id", allProcIds);
    if (pErr) throw new Error(pErr.message);
    if (!procs || procs.length !== allProcIds.length) throw new Error("Procedimento inválido");
    const procMap = new Map(procs.map((p) => [p.id, p]));

    const perPro = data.professionals.map((entry) => {
      const items = entry.procedureIds.map((id) => {
        const p: any = procMap.get(id)!;
        return {
          id: p.id,
          name: p.name,
          price: priceForProc(p, data.hairLength ?? null),
          blocks: p.duration_blocks,
          category: p.category,
        };
      });
      return {
        professionalId: entry.professionalId,
        role: entry.role,
        startBlock: entry.startBlock,
        items,
        totalBlocks: items.reduce((s, i) => s + i.blocks, 0),
        totalPrice: items.reduce((s, i) => s + i.price, 0),
      };
    });

    // Adjacency rule: when hair + nails are booked together, nails must be
    // immediately before or after hair (no gap, no overlap).
    const hair = perPro.find((p) => p.role === "hairdresser");
    const nails = perPro.find((p) => p.role === "manicurist");
    if (hair && nails) {
      const nailsEnd = nails.startBlock + nails.totalBlocks;
      const hairEnd = hair.startBlock + hair.totalBlocks;
      const adjacent = nailsEnd === hair.startBlock || hairEnd === nails.startBlock;
      if (!adjacent) throw new Error("A manicure precisa estar imediatamente antes ou depois do horário do cabelo.");
    }

    // Working-hours + availability check
    const ids = perPro.map((p) => p.professionalId);
    const { busyByPro, schedMap, dayOffSet } = await loadProContext(ids, data.date);
    for (const p of perPro) {
      if (dayOffSet.has(p.professionalId)) throw new Error("Profissional está de folga nesta data.");
      const w = proWindow(schedMap.get(p.professionalId));
      if (!isValidStart(p.startBlock, p.totalBlocks, w, busyByPro.get(p.professionalId)!)) {
        throw new Error("Horário não está mais disponível.");
      }
    }

    // Promotion validation: superset match
    let promotion: any = null;
    let promoProcIds = new Set<string>();
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
        const pIds = new Set<string>((promo.promotion_procedures ?? []).map((pp: any) => pp.procedure_id));
        const allIncluded = [...pIds].every((id) => allProcIds.includes(id));
        if (allIncluded) {
          promotion = promo;
          promoProcIds = pIds;
        }
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
      await supabaseAdmin.from("clients").update({ name: data.clientName }).eq("id", clientId);
    } else {
      const { data: ins, error: cErr } = await supabaseAdmin
        .from("clients")
        .insert({ name: data.clientName, phone })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      clientId = ins.id;
    }

    const groupId = crypto.randomUUID();
    const discount = promotion ? Number(promotion.original_price) - Number(promotion.promo_price) : 0;
    const promoSumByPro = new Map<string, number>();
    let totalPromoSum = 0;
    if (promotion) {
      for (const p of perPro) {
        const s = p.items.filter((i) => promoProcIds.has(i.id)).reduce((a, i) => a + i.price, 0);
        promoSumByPro.set(p.professionalId, s);
        totalPromoSum += s;
      }
    }

    const createdIds: string[] = [];
    let sumAppliedTotal = 0;
    for (const p of perPro) {
      let priceToUse = p.totalPrice;
      if (promotion && totalPromoSum > 0) {
        const proDiscount = discount * ((promoSumByPro.get(p.professionalId) ?? 0) / totalPromoSum);
        priceToUse = Math.max(0, Math.round((p.totalPrice - proDiscount) * 100) / 100);
      }
      sumAppliedTotal += priceToUse;
      const { data: appt, error: aErr } = await supabaseAdmin
        .from("appointments")
        .insert({
          client_id: clientId,
          professional_id: p.professionalId,
          scheduled_date: data.date,
          start_block: p.startBlock,
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

    return { ids: createdIds, groupId, totalPrice: sumAppliedTotal, promotionApplied: !!promotion };
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
    .eq("username", ADMIN_USERNAME)
    .maybeSingle();
  if (existing) return { email: existing.email ?? ADMIN_EMAIL };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { username: ADMIN_USERNAME },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar admin");
  await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    username: ADMIN_USERNAME,
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
    if (data.username === ADMIN_USERNAME) return { email: ADMIN_EMAIL };
    throw new Error("Usuário não encontrado");
  });
