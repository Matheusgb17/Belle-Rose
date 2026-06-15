import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OPEN_BLOCK, CLOSE_BLOCK } from "./time";

const ADMIN_EMAIL = "adm@salao.app";
const ADMIN_DEFAULT_PASSWORD = "123";

// ---------- Public reads ----------

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
    .map((p) => ({
      ...p,
      roles: map.get(p.id) ?? [],
    }))
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
    .select("*, promotion_procedures(procedure_id, procedures(name))")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// ---------- Slot algorithm ----------

export const getAvailableSlots = createServerFn({ method: "POST" })
  .inputValidator((input: { professionalId: string; date: string; totalBlocks: number }) =>
    z
      .object({
        professionalId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        totalBlocks: z.number().int().min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appts, error } = await supabaseAdmin
      .from("appointments")
      .select("start_block, total_blocks")
      .eq("professional_id", data.professionalId)
      .eq("scheduled_date", data.date)
      .eq("status", "confirmed");
    if (error) throw new Error(error.message);

    const busy = new Set<number>();
    (appts ?? []).forEach((a) => {
      for (let i = 0; i < a.total_blocks; i++) busy.add(a.start_block + i);
    });

    const slots: number[] = [];
    const now = new Date();
    const isToday = data.date === now.toISOString().slice(0, 10);
    const nowBlock = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);

    for (let s = OPEN_BLOCK; s + data.totalBlocks <= CLOSE_BLOCK; s++) {
      if (isToday && s <= nowBlock) continue;
      let ok = true;
      for (let i = 0; i < data.totalBlocks; i++) {
        if (busy.has(s + i)) {
          ok = false;
          break;
        }
      }
      if (ok) slots.push(s);
    }
    return slots;
  });

// ---------- Booking ----------

const cartItemSchema = z.object({
  procedureId: z.string().uuid(),
});

export const createAppointment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      clientName: string;
      clientPhone: string;
      clientEmail?: string;
      professionalId: string;
      date: string;
      startBlock: number;
      items: { procedureId: string }[];
    }) =>
      z
        .object({
          clientName: z.string().trim().min(2).max(120),
          clientPhone: z.string().trim().min(8).max(20),
          clientEmail: z.string().email().max(160).optional().or(z.literal("")),
          professionalId: z.string().uuid(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          startBlock: z.number().int().min(0).max(47),
          items: z.array(cartItemSchema).min(1).max(10),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get procedures
    const procIds = data.items.map((i) => i.procedureId);
    const { data: procs, error: pErr } = await supabaseAdmin
      .from("procedures")
      .select("id, name, price, duration_blocks")
      .in("id", procIds);
    if (pErr) throw new Error(pErr.message);
    if (!procs || procs.length !== procIds.length) throw new Error("Procedimento inválido");

    const totalBlocks = procs.reduce((s, p) => s + p.duration_blocks, 0);
    const totalPrice = procs.reduce((s, p) => s + Number(p.price), 0);

    // Validate availability (re-check)
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("start_block, total_blocks")
      .eq("professional_id", data.professionalId)
      .eq("scheduled_date", data.date)
      .eq("status", "confirmed");
    const busy = new Set<number>();
    (appts ?? []).forEach((a) => {
      for (let i = 0; i < a.total_blocks; i++) busy.add(a.start_block + i);
    });
    for (let i = 0; i < totalBlocks; i++) {
      if (busy.has(data.startBlock + i)) throw new Error("Horário não está mais disponível");
    }
    if (data.startBlock + totalBlocks > CLOSE_BLOCK || data.startBlock < OPEN_BLOCK)
      throw new Error("Horário fora do expediente");

    // Upsert client by phone
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

    const { data: appt, error: aErr } = await supabaseAdmin
      .from("appointments")
      .insert({
        client_id: clientId,
        professional_id: data.professionalId,
        scheduled_date: data.date,
        start_block: data.startBlock,
        total_blocks: totalBlocks,
        total_price: totalPrice,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);

    const items = procs.map((p) => ({
      appointment_id: appt.id,
      procedure_id: p.id,
      procedure_name: p.name,
      price: p.price,
      blocks: p.duration_blocks,
    }));
    await supabaseAdmin.from("appointment_items").insert(items);

    return { id: appt.id, totalPrice, totalBlocks };
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
        "id, scheduled_date, start_block, total_blocks, total_price, status, professional:profiles(full_name), appointment_items(procedure_name, price)",
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
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.appointmentId)
      .eq("client_id", client.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin bootstrap ----------

export const ensureAdminUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Check if admin profile exists
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("username", "adm")
    .maybeSingle();
  if (existing) return { email: existing.email ?? ADMIN_EMAIL };

  // Create auth user
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
    // If looks like email use as-is
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
