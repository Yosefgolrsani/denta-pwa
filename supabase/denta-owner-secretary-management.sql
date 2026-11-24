-- Denta: primary clinic owner manages secretaries in their own clinic.
-- Review and run manually in Supabase SQL Editor. RLS remains enabled.
-- Existing registered Denta accounts only; dentists and clinic managers cannot be changed.

BEGIN;

CREATE OR REPLACE FUNCTION public.denta_owner_list_secretaries(target_clinic uuid)
RETURNS TABLE (member_id uuid, user_email text, created_at timestamptz, finance_enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = target_clinic AND c.owner_id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only the primary owner can manage this clinic secretaries';
  END IF;
  RETURN QUERY
  SELECT cm.id, u.email::text, cm.created_at,
    EXISTS (SELECT 1 FROM public.clinic_finance_permissions fp WHERE fp.clinic_id = cm.clinic_id AND fp.secretary_member_id = cm.id)
  FROM public.clinic_members cm
  JOIN auth.users u ON u.id = cm.user_id
  WHERE cm.clinic_id = target_clinic AND cm.role = 'secretary'
  ORDER BY cm.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.denta_owner_add_secretary(target_clinic uuid, target_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target_user uuid; existing_role text; new_member_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = target_clinic AND c.owner_id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only the primary owner can add secretaries to this clinic';
  END IF;
  IF target_email IS NULL OR pg_catalog.btrim(target_email) = '' THEN
    RAISE EXCEPTION 'A registered user email is required';
  END IF;
  SELECT u.id INTO target_user FROM auth.users u
  WHERE pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(target_email)) LIMIT 1;
  IF target_user IS NULL THEN RAISE EXCEPTION 'No registered Denta account was found for this email'; END IF;
  IF target_user = (SELECT c.owner_id FROM public.clinics c WHERE c.id = target_clinic) THEN
    RAISE EXCEPTION 'The clinic owner cannot be added as a secretary';
  END IF;
  SELECT cm.role INTO existing_role FROM public.clinic_members cm
  WHERE cm.clinic_id = target_clinic AND cm.user_id = target_user LIMIT 1;
  IF existing_role IS NOT NULL AND existing_role <> 'secretary' THEN
    RAISE EXCEPTION 'This account already has a protected clinic role and cannot be changed';
  END IF;
  IF existing_role = 'secretary' THEN
    SELECT cm.id INTO new_member_id FROM public.clinic_members cm
    WHERE cm.clinic_id = target_clinic AND cm.user_id = target_user AND cm.role = 'secretary' LIMIT 1;
    RETURN new_member_id;
  END IF;
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (target_clinic, target_user, 'secretary') RETURNING id INTO new_member_id;
  RETURN new_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.denta_owner_remove_secretary(target_clinic uuid, target_secretary_member uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = target_clinic AND c.owner_id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only the primary owner can remove secretaries from this clinic';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinic_members cm
    WHERE cm.id = target_secretary_member AND cm.clinic_id = target_clinic AND cm.role = 'secretary') THEN
    RAISE EXCEPTION 'The selected member is not a secretary of this clinic';
  END IF;
  DELETE FROM public.clinic_finance_permissions fp
  WHERE fp.clinic_id = target_clinic AND fp.secretary_member_id = target_secretary_member;
  DELETE FROM public.clinic_members cm
  WHERE cm.id = target_secretary_member AND cm.clinic_id = target_clinic AND cm.role = 'secretary';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.denta_owner_list_secretaries(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_owner_add_secretary(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_owner_remove_secretary(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.denta_owner_list_secretaries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_owner_add_secretary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_owner_remove_secretary(uuid, uuid) TO authenticated;

COMMIT;
