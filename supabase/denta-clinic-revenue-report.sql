-- Denta clinic revenue report
-- Secure aggregate report for clinic members with financial permission.
-- SECURITY INVOKER ensures payments RLS policies remain in force.
CREATE OR REPLACE FUNCTION public.denta_clinic_revenue_report(
  target_clinic uuid,
  p_from_date date,
  p_to_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  report_data jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF target_clinic IS NULL OR p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'Invalid clinic or date range';
  END IF;

  IF NOT public.denta_secretary_has_finance_access(target_clinic) THEN
    RAISE EXCEPTION 'Financial permission required';
  END IF;

  SELECT jsonb_build_object(
    'total_amount', COALESCE(SUM(daily.total_amount), 0),
    'payment_count', COALESCE(SUM(daily.payment_count), 0),
    'daily', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'day', daily.payment_day,
          'total_amount', daily.total_amount,
          'payment_count', daily.payment_count
        ) ORDER BY daily.payment_day
      ),
      '[]'::jsonb
    )
  )
  INTO report_data
  FROM (
    SELECT
      (p.payment_date AT TIME ZONE 'Asia/Tehran')::date AS payment_day,
      SUM(p.amount) AS total_amount,
      COUNT(*) AS payment_count
    FROM public.payments AS p
    WHERE p.clinic_id = target_clinic
      AND (p.payment_date AT TIME ZONE 'Asia/Tehran')::date BETWEEN p_from_date AND p_to_date
    GROUP BY (p.payment_date AT TIME ZONE 'Asia/Tehran')::date
  ) AS daily;

  RETURN COALESCE(report_data, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.denta_clinic_revenue_report(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.denta_clinic_revenue_report(uuid, date, date) TO authenticated;
