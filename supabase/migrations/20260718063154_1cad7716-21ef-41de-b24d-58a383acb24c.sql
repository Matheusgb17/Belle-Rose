
-- Working schedules per professional
CREATE TABLE public.professional_schedules (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  start_block SMALLINT NOT NULL DEFAULT 18,
  end_block SMALLINT NOT NULL DEFAULT 38,
  lunch_start_block SMALLINT,
  lunch_end_block SMALLINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.professional_schedules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.professional_schedules TO authenticated;
GRANT ALL ON public.professional_schedules TO service_role;
ALTER TABLE public.professional_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules public read" ON public.professional_schedules FOR SELECT USING (true);
CREATE POLICY "schedules owner write" ON public.professional_schedules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Days off per professional
CREATE TABLE public.professional_days_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT ON public.professional_days_off TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.professional_days_off TO authenticated;
GRANT ALL ON public.professional_days_off TO service_role;
ALTER TABLE public.professional_days_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "days off public read" ON public.professional_days_off FOR SELECT USING (true);
CREATE POLICY "days off owner write" ON public.professional_days_off FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per hair-length pricing for procedures
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS by_length BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_short NUMERIC,
  ADD COLUMN IF NOT EXISTS price_medium NUMERIC,
  ADD COLUMN IF NOT EXISTS price_long NUMERIC,
  ADD COLUMN IF NOT EXISTS price_xlong NUMERIC;
