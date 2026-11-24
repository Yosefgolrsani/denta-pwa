-- Denta financial access audit (READ ONLY)
-- Run this in Supabase SQL Editor for project denta-clinic.
-- This script does not change tables, policies, permissions, or data.

-- 1) Confirm payments table columns and RLS status.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('payments', 'subscription_payments');

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('payments', 'subscription_payments')
ORDER BY table_name, ordinal_position;

-- 2) Show all existing RLS policies on financial and related tables.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'payments',
    'subscription_payments',
    'subscriptions',
    'clinic_members',
    'clinics',
    'admins'
  )
ORDER BY tablename, policyname;

-- 3) Show table privileges for API roles.
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('payments', 'subscription_payments')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 4) Show existing helper functions relevant to clinic roles/ownership.
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_clinic_member',
    'is_denta_admin',
    'is_denta_super_admin',
    'current_clinic_role'
  )
ORDER BY p.proname;
