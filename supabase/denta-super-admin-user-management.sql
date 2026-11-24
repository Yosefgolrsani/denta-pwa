-- Denta super-admin user management
-- Run only in the Denta Supabase project after reviewing this file.
-- RLS remains enabled. These SECURITY DEFINER RPCs explicitly verify super-admin access.

CREATE OR REPLACE FUNCTION public.denta_super_admin_list_clinics()
RETURNS TABLE (
  clinic_id uuid,
  clinic_name text,
  owner_id uuid,
  member_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_denta_super_admin() THEN
    RAISE EXCEPTION 'اجازه دسترسی ندارید';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.owner_id,
         (SELECT count(*) FROM public.clinic_members m WHERE m.clinic_id = c.id)
  FROM public.clinics c
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.denta_super_admin_list_members(target_clinic uuid)
RETURNS TABLE (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  is_owner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_denta_super_admin() THEN
    RAISE EXCEPTION 'اجازه دسترسی ندارید';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = target_clinic) THEN
    RAISE EXCEPTION 'کلینیک پیدا نشد';
  END IF;

  RETURN QUERY
  SELECT m.id, m.user_id, u.email::text,
         COALESCE(u.raw_user_meta_data ->> 'full_name',
                  u.raw_user_meta_data ->> 'name',
                  u.raw_user_meta_data ->> 'manager_name'),
         m.role, m.created_at, (c.owner_id = m.user_id)
  FROM public.clinic_members m
  JOIN auth.users u ON u.id = m.user_id
  JOIN public.clinics c ON c.id = m.clinic_id
  WHERE m.clinic_id = target_clinic
  ORDER BY m.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.denta_super_admin_assign_member(
  target_clinic uuid,
  target_email text,
  target_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user uuid;
  result_member uuid;
  clinic_owner uuid;
BEGIN
  IF NOT public.is_denta_super_admin() THEN
    RAISE EXCEPTION 'اجازه دسترسی ندارید';
  END IF;

  IF target_role NOT IN ('manager', 'secretary') THEN
    RAISE EXCEPTION 'در این بخش فقط نقش مدیر کلینیک یا منشی قابل تخصیص است';
  END IF;

  IF target_email IS NULL OR pg_catalog.btrim(target_email) = '' THEN
    RAISE EXCEPTION 'ایمیل را وارد کنید';
  END IF;

  SELECT c.owner_id INTO clinic_owner
  FROM public.clinics c
  WHERE c.id = target_clinic;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'کلینیک پیدا نشد';
  END IF;

  SELECT u.id INTO target_user
  FROM auth.users u
  WHERE pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(target_email))
  LIMIT 1;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'این ایمیل هنوز در دنتا ثبت‌نام نکرده است';
  END IF;

  IF target_user = clinic_owner AND target_role <> 'manager' THEN
    RAISE EXCEPTION 'مالک کلینیک باید نقش مدیر داشته باشد';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinic_members m
    WHERE m.clinic_id = target_clinic
      AND m.user_id = target_user
      AND m.role = 'dentist'
  ) THEN
    RAISE EXCEPTION 'این حساب دندان‌پزشک است؛ تغییر نقش آن از این بخش مجاز نیست';
  END IF;

  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (target_clinic, target_user, target_role)
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET role = EXCLUDED.role
  RETURNING id INTO result_member;

  RETURN result_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.denta_super_admin_remove_member(target_member uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_clinic uuid;
  target_user uuid;
  target_role text;
  clinic_owner uuid;
  other_managers bigint;
BEGIN
  IF NOT public.is_denta_super_admin() THEN
    RAISE EXCEPTION 'اجازه دسترسی ندارید';
  END IF;

  SELECT m.clinic_id, m.user_id, m.role, c.owner_id
  INTO target_clinic, target_user, target_role, clinic_owner
  FROM public.clinic_members m
  JOIN public.clinics c ON c.id = m.clinic_id
  WHERE m.id = target_member;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'عضویت پیدا نشد';
  END IF;

  IF target_user = clinic_owner THEN
    RAISE EXCEPTION 'عضویت مالک کلینیک از این بخش قابل حذف نیست';
  END IF;

  IF target_role = 'manager' THEN
    SELECT count(*) INTO other_managers
    FROM public.clinic_members m
    WHERE m.clinic_id = target_clinic
      AND m.role = 'manager'
      AND m.id <> target_member;

    IF other_managers = 0 THEN
      RAISE EXCEPTION 'ابتدا یک مدیر دیگر برای این کلینیک تعیین کنید';
    END IF;
  END IF;

  DELETE FROM public.clinic_members WHERE id = target_member;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.denta_super_admin_list_clinics() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_super_admin_list_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_super_admin_assign_member(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.denta_super_admin_remove_member(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.denta_super_admin_list_clinics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_super_admin_list_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_super_admin_assign_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.denta_super_admin_remove_member(uuid) TO authenticated;
