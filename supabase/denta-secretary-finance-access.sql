-- Denta: secure secretary access to patient payment records
-- Apply only after reviewing this migration. Keeps RLS enabled.
-- The clinic owner (clinics.owner_id) alone can grant/revoke secretary finance access.
-- Secretaries with permission may SELECT, INSERT and UPDATE payments; never DELETE.

BEGIN;

CREATE TABLE IF NOT EXISTS public.clinic_finance_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  secretary_member_id uuid NOT NULL REFERENCES public.clinic_members(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, secretary_member_id)
);

ALTER TABLE public.clinic_finance_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clinic_finance_permissions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.denta_secretary_has_finance_access(target_clinic uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_denta_super_admin()
    OR public.current_clinic_role(target_clinic) = 'manager'
    OR EXISTS (
      SELECT 1
      FROM public.clinic_members cm
      JOIN public.clinic_finance_permissions fp
        ON fp.secretary_member_id = cm.id
       AND fp.clinic_id = cm.clinic_id
      WHERE cm.clinic_id = target_clinic
        AND cm.user_id = auth.uid()
        AND cm.role = 'secretary'
    );
$$;

CREATE OR REPLACE FUNCTION public.denta_grant_secretary_finance_access(
  target_clinic uuid,
  target_secretary_member uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = target_clinic AND c.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the primary clinic owner can grant financial access';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.id = target_secretary_member
      AND cm.clinic_id = target_clinic
      AND cm.role = 'secretary'
  ) THEN
    RAISE EXCEPTION 'The selected member is not a secretary of this clinic';
  END IF;

  INSERT INTO public.clinic_finance_permissions
    (clinic_id, secretary_member_id, granted_by)
  VALUES (target_clinic, target_secretary_member, auth.uid())
  ON CONFLICT (clinic_id, secretary_member_id)
  DO UPDATE SET granted_by = EXCLUDED.granted_by, created_at = now();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.denta_revoke_secretary_finance_access(
  target_clinic uuid,
  target_secretary_member uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = target_clinic AND c.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the primary clinic owner can revoke financial access';
  END IF;

  DELETE FROM public.clinic_finance_permissions fp
  WHERE fp.clinic_id = target_clinic
    AND fp.secretary_member_id = target_secretary_member;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.denta_can_view_clinic_billing(target_clinic uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_denta_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = target_clinic
        AND (
          c.owner_id = auth.uid()
          OR public.current_clinic_role(target_clinic) = 'manager'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.denta_secretary_has_finance_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_grant_secretary_finance_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_revoke_secretary_finance_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_can_view_clinic_billing(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.denta_secretary_has_finance_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_grant_secretary_finance_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_revoke_secretary_finance_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_can_view_clinic_billing(uuid) TO authenticated;

-- Remove the broad policy that currently gives secretaries ALL payment operations.
DROP POLICY IF EXISTS "Managers and secretaries manage patient payments" ON public.payments;

CREATE POLICY "Managers and super admins manage patient payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  (public.current_clinic_role(clinic_id) = 'manager' OR public.is_denta_super_admin())
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = payments.patient_id AND p.clinic_id = payments.clinic_id
  )
)
WITH CHECK (
  (public.current_clinic_role(clinic_id) = 'manager' OR public.is_denta_super_admin())
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = payments.patient_id AND p.clinic_id = payments.clinic_id
  )
);

CREATE POLICY "Authorized secretaries view patient payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.current_clinic_role(clinic_id) = 'secretary'
  AND public.denta_secretary_has_finance_access(clinic_id)
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = payments.patient_id AND p.clinic_id = payments.clinic_id
  )
);

CREATE POLICY "Authorized secretaries insert patient payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_clinic_role(clinic_id) = 'secretary'
  AND public.denta_secretary_has_finance_access(clinic_id)
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = payments.patient_id AND p.clinic_id = payments.clinic_id
  )
);

CREATE POLICY "Authorized secretaries update patient payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (
  public.current_clinic_role(clinic_id) = 'secretary'
  AND public.denta_secretary_has_finance_access(clinic_id)
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = payments.patient_id AND p.clinic_id = payments.clinic_id
  )
)
WITH CHECK (
  public.current_clinic_role(clinic_id) = 'secretary'
  AND public.denta_secretary_has_finance_access(clinic_id)
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = payments.patient_id AND p.clinic_id = payments.clinic_id
  )
);

-- Billing/subscription payment history is visible only to clinic management and Denta super-admin.
DROP POLICY IF EXISTS "View subscription payment records" ON public.subscription_payments;
CREATE POLICY "Clinic managers view subscription payment records"
ON public.subscription_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.id = subscription_payments.subscription_id
      AND public.denta_can_view_clinic_billing(s.clinic_id)
  )
);

DROP POLICY IF EXISTS "View clinic subscriptions" ON public.subscriptions;
CREATE POLICY "Clinic managers view clinic subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.denta_can_view_clinic_billing(clinic_id));

-- Remove anonymous access and non-RLS table privileges that are unnecessary for client roles.
REVOKE ALL ON TABLE public.payments, public.subscription_payments, public.subscriptions FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payments, public.subscription_payments, public.subscriptions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.subscription_payments, public.subscriptions TO authenticated;

COMMIT;
