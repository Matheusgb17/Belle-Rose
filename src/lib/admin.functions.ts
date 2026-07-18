import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.length) throw new Error("Acesso negado");
  return roles as string[];
}
async function assertAdmin(context: { supabase: any; userId: string }) {
  const roles = await assertStaff(context);
  if (!roles.includes("admin")) throw new Error("Apenas administrador");
}

// ---------- Procedures ----------

export const upsertProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      category: "cabelo" | "unhas" | "estetica" | "outros";
      description?: string;
      price: number;
      duration_blocks: number;
      by_length?: boolean;
      price_short?: number | null;
      price_medium?: number | null;
      price_long?: number | null;
      price_xlong?: number | null;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(2).max(120),
          category: z.enum(["cabelo", "unhas", "estetica", "outros"]),
          description: z.string().max(500).optional(),
          price: z.number().min(0).max(99999),
          duration_blocks: z.number().int().min(1).max(20),
          by_length: z.boolean().optional(),
          price_short: z.number().min(0).nullable().optional(),
          price_medium: z.number().min(0).nullable().optional(),
          price_long: z.number().min(0).nullable().optional(),
          price_xlong: z.number().min(0).nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      category: data.category,
      description: data.description ?? null,
      price: data.price,
      duration_blocks: data.duration_blocks,
      by_length: data.by_length ?? false,
      price_short: data.price_short ?? null,
      price_medium: data.price_medium ?? null,
      price_long: data.price_long ?? null,
      price_xlong: data.price_xlong ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("procedures").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("procedures").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("procedures")
      .update({ is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Professionals ----------

export const listAllProfessionals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, phone, email, photo_url, is_active")
      .order("full_name");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const map = new Map<string, string[]>();
    (roles ?? []).forEach((r) =>
      map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role]),
    );
    return (profs ?? [])
      .map((p) => ({ ...p, roles: map.get(p.id) ?? [] }))
      .filter((p) => !p.roles.includes("admin"));
  });

export const createProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      username: string;
      full_name: string;
      role: "hairdresser" | "manicurist";
      email: string;
      phone?: string;
      password: string;
      photo_url?: string;
    }) =>
      z
        .object({
          username: z
            .string()
            .trim()
            .min(3)
            .max(40)
            .regex(/^[a-z0-9_.-]+$/i),
          full_name: z.string().trim().min(2).max(120),
          role: z.enum(["hairdresser", "manicurist"]),
          email: z.string().email().max(160),
          phone: z.string().max(20).optional(),
          password: z.string().min(4).max(60),
          photo_url: z.string().url().max(500).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha");
    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: data.username,
      full_name: data.full_name,
      phone: data.phone ?? null,
      email: data.email,
      photo_url: data.photo_url ?? null,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { ok: true };
  });

export const toggleProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_active: boolean }) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    return { ok: true };
  });

export const deleteProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.deleteUser(data.id);
    return { ok: true };
  });

// ---------- Promotions ----------

export const upsertPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      description?: string;
      procedure_ids: string[];
      promo_price: number;
      start_date: string;
      end_date: string;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(2).max(120),
          description: z.string().max(500).optional(),
          procedure_ids: z.array(z.string().uuid()).min(1).max(10),
          promo_price: z.number().min(0),
          start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: procs } = await supabaseAdmin
      .from("procedures")
      .select("price")
      .in("id", data.procedure_ids);
    const original = (procs ?? []).reduce((s, p) => s + Number(p.price), 0);
    const discount = original > 0 ? ((original - data.promo_price) / original) * 100 : 0;

    let promoId = data.id;
    if (promoId) {
      await supabaseAdmin
        .from("promotions")
        .update({
          name: data.name,
          description: data.description ?? null,
          original_price: original,
          promo_price: data.promo_price,
          discount_percent: Math.round(discount * 100) / 100,
          start_date: data.start_date,
          end_date: data.end_date,
        })
        .eq("id", promoId);
      await supabaseAdmin.from("promotion_procedures").delete().eq("promotion_id", promoId);
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("promotions")
        .insert({
          name: data.name,
          description: data.description ?? null,
          original_price: original,
          promo_price: data.promo_price,
          discount_percent: Math.round(discount * 100) / 100,
          start_date: data.start_date,
          end_date: data.end_date,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      promoId = ins.id;
    }
    await supabaseAdmin
      .from("promotion_procedures")
      .insert(data.procedure_ids.map((procedure_id) => ({ promotion_id: promoId!, procedure_id })));
    return { ok: true };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("promotions").delete().eq("id", data.id);
    return { ok: true };
  });

export const listAllPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("promotions")
      .select("*, promotion_procedures(procedure_id, procedures(name))")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

// ---------- Appointments (staff view) ----------

export const listAppointments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: "mine" | "all"; from?: string; to?: string }) =>
    z
      .object({
        scope: z.enum(["mine", "all"]),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("appointments")
      .select(
        "id, scheduled_date, start_block, total_blocks, total_price, status, professional:profiles(id, full_name), client:clients(name, phone), appointment_items(procedure_name)",
      )
      .order("scheduled_date", { ascending: true })
      .order("start_block");
    if (data.from) q = q.gte("scheduled_date", data.from);
    if (data.to) q = q.lte("scheduled_date", data.to);
    if (data.scope === "mine" || !roles.includes("admin")) {
      q = q.eq("professional_id", context.userId);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const cancelAppointmentStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (!roles.includes("admin")) q = q.eq("professional_id", context.userId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Dashboard ----------

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const weekFrom = new Date();
    weekFrom.setDate(weekFrom.getDate() - 7);
    const monthFrom = new Date();
    monthFrom.setDate(1);

    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("scheduled_date, total_price, status, professional:profiles(full_name), appointment_items(procedure_name, price)")
      .gte("scheduled_date", monthFrom.toISOString().slice(0, 10));

    const all = appts ?? [];
    const active = all.filter((a) => a.status !== "cancelled");
    const todayCount = active.filter((a) => a.scheduled_date === today).length;
    const weekCount = active.filter((a) => a.scheduled_date >= weekFrom.toISOString().slice(0, 10)).length;
    const monthCount = active.length;
    const revenue = active.reduce((s, a) => s + Number(a.total_price), 0);
    const procCount = new Map<string, number>();
    const byProf = new Map<string, number>();
    active.forEach((a) => {
      (a.appointment_items ?? []).forEach((it: any) => {
        procCount.set(it.procedure_name, (procCount.get(it.procedure_name) ?? 0) + 1);
      });
      const pn = (a.professional as any)?.full_name ?? "—";
      byProf.set(pn, (byProf.get(pn) ?? 0) + 1);
    });
    const topProcs = Array.from(procCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
    const byProfArr = Array.from(byProf.entries()).map(([name, count]) => ({ name, count }));

    return { todayCount, weekCount, monthCount, revenue, topProcs, byProfArr };
  });

export const meRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("full_name, username")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      roles: (data ?? []).map((r) => r.role as string),
      profile: prof,
    };
  });

// ---------- Salon settings ----------

export const updateSalonSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      tagline?: string;
      address?: string;
      phone?: string;
      whatsapp?: string;
      instagram_url?: string;
      facebook_url?: string;
    }) =>
      z
        .object({
          name: z.string().trim().min(2).max(120),
          tagline: z.string().max(240).optional(),
          address: z.string().max(240).optional(),
          phone: z.string().max(40).optional(),
          whatsapp: z.string().max(40).optional(),
          instagram_url: z.string().max(240).optional().or(z.literal("")),
          facebook_url: z.string().max(240).optional().or(z.literal("")),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("salon_settings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const payload = {
      name: data.name,
      tagline: data.tagline ?? "",
      address: data.address ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      instagram_url: data.instagram_url ?? "",
      facebook_url: data.facebook_url ?? "",
    };
    if (existing) {
      const { error } = await supabaseAdmin.from("salon_settings").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("salon_settings").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Professional schedule & days off (self-service) ----------

export const getMySchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("professional_schedules")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

export const updateMySchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      start_block: number;
      end_block: number;
      lunch_start_block: number | null;
      lunch_end_block: number | null;
    }) =>
      z
        .object({
          start_block: z.number().int().min(0).max(47),
          end_block: z.number().int().min(1).max(48),
          lunch_start_block: z.number().int().min(0).max(47).nullable(),
          lunch_end_block: z.number().int().min(1).max(48).nullable(),
        })
        .refine((v) => v.end_block > v.start_block, { message: "Horário final deve ser após o inicial" })
        .refine(
          (v) =>
            (v.lunch_start_block == null && v.lunch_end_block == null) ||
            (v.lunch_start_block != null &&
              v.lunch_end_block != null &&
              v.lunch_end_block > v.lunch_start_block &&
              v.lunch_start_block >= v.start_block &&
              v.lunch_end_block <= v.end_block),
          { message: "Almoço deve estar dentro do expediente" },
        )
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("professional_schedules")
      .upsert({ user_id: context.userId, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyDaysOff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabaseAdmin
      .from("professional_days_off")
      .select("*")
      .eq("user_id", context.userId)
      .gte("day", today)
      .order("day");
    return data ?? [];
  });

export const addMyDayOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { day: string; reason?: string }) =>
    z
      .object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("professional_days_off")
      .upsert({ user_id: context.userId, day: data.day, reason: data.reason ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMyDayOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("professional_days_off")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


