-- Denta: list clinic secretaries and their finance permission state.
-- Run after denta-secretary-finance-access.sql.
CREATE OR REPLACE FUNCTION public.denta_owner_list_secretary_finance_access(target_clinic uuid)
RETURNS TABLE (
  member_id uuid,
  user_email text,
  full_name text,
  finance_enabled boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = target_clinic
      AND c.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the primary clinic owner can manage secretary finance access';
  END IF;

  RETURN QUERY
  SELECT
    cm.id,
    u.email::text,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
    (fp.id IS NOT NULL)
  FROM public.clinic_members cm
  JOIN auth.users u ON u.id = cm.user_id
  LEFT JOIN public.clinic_finance_permissions fp
    ON fp.clinic_id = cm.clinic_id
   AND fp.secretary_member_id = cm.id
  WHERE cm.clinic_id = target_clinic
    AND cm.role = 'secretary'
  ORDER BY u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.denta_owner_list_secretary_finance_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.denta_owner_list_secretary_finance_access(uuid) TO authenticated;
