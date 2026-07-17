
DROP POLICY IF EXISTS "Public read procedures" ON public.procedures;
CREATE POLICY "Public read active procedures" ON public.procedures
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

REVOKE SELECT (created_by) ON public.promotions FROM anon, public;
