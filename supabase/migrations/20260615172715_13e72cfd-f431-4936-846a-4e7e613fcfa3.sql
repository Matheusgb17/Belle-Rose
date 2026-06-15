
-- Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'hairdresser', 'manicurist');
CREATE TYPE public.appointment_status AS ENUM ('confirmed', 'cancelled', 'completed');
CREATE TYPE public.procedure_category AS ENUM ('cabelo', 'unhas', 'estetica', 'outros');

-- Profiles (mirrors auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- RLS profiles: everyone can read active profiles (for choosing professional), users can update own
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view roles" ON public.user_roles FOR SELECT USING (true);

-- Procedures (universal list)
CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category public.procedure_category NOT NULL DEFAULT 'outros',
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  duration_blocks INTEGER NOT NULL CHECK (duration_blocks > 0 AND duration_blocks <= 20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.procedures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read procedures" ON public.procedures FOR SELECT USING (true);
CREATE POLICY "Staff manage procedures" ON public.procedures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hairdresser') OR public.has_role(auth.uid(), 'manicurist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hairdresser') OR public.has_role(auth.uid(), 'manicurist'));

-- Promotions
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  original_price NUMERIC(10,2) NOT NULL,
  promo_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active promotions" ON public.promotions FOR SELECT USING (true);
CREATE POLICY "Staff manage promotions" ON public.promotions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hairdresser'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hairdresser'));

CREATE TABLE public.promotion_procedures (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, procedure_id)
);
GRANT SELECT ON public.promotion_procedures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_procedures TO authenticated;
GRANT ALL ON public.promotion_procedures TO service_role;
ALTER TABLE public.promotion_procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read promo procedures" ON public.promotion_procedures FOR SELECT USING (true);
CREATE POLICY "Staff manage promo procedures" ON public.promotion_procedures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hairdresser'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hairdresser'));

-- Clients (keyed by phone)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
-- Client operations go through server functions with admin client; no direct policy needed.
CREATE POLICY "Staff read clients" ON public.clients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hairdresser') OR public.has_role(auth.uid(), 'manicurist'));

-- Appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_block INTEGER NOT NULL CHECK (start_block >= 0 AND start_block < 48),
  total_blocks INTEGER NOT NULL CHECK (total_blocks > 0),
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.appointment_status NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appt_prof_date ON public.appointments(professional_id, scheduled_date, status);
CREATE POLICY "Staff view appointments" ON public.appointments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR professional_id = auth.uid()
  );
CREATE POLICY "Staff update own appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR professional_id = auth.uid());

CREATE TABLE public.appointment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES public.procedures(id),
  procedure_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  blocks INTEGER NOT NULL
);
GRANT SELECT ON public.appointment_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_items TO authenticated;
GRANT ALL ON public.appointment_items TO service_role;
ALTER TABLE public.appointment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view appointment items" ON public.appointment_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND (public.has_role(auth.uid(), 'admin') OR a.professional_id = auth.uid())));

-- Seed some sample procedures
INSERT INTO public.procedures (name, category, description, price, duration_blocks) VALUES
  ('Corte Feminino', 'cabelo', 'Corte personalizado', 80, 1),
  ('Escova', 'cabelo', 'Escova modeladora', 60, 2),
  ('Hidratação', 'cabelo', 'Tratamento profundo', 120, 2),
  ('Coloração', 'cabelo', 'Coloração completa', 250, 4),
  ('Progressiva', 'cabelo', 'Alisamento progressivo', 400, 8),
  ('Manicure', 'unhas', 'Manicure tradicional', 40, 2),
  ('Pedicure', 'unhas', 'Pedicure tradicional', 50, 2),
  ('Esmaltação em Gel', 'unhas', 'Gel duradouro', 90, 3);
