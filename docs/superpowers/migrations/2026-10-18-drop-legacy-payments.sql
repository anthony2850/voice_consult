-- Drop the legacy 990원 report payment funnel.
-- The app no longer has /checkout, /report, /api/payment/confirm or /api/generate-report.
-- Run in the Supabase SQL editor.

-- 1) payments — dropped only when it holds no real (DONE) payments.
--    Real payment records must be kept for 5 years (전자상거래법 시행령 제6조), so if any exist
--    this block leaves the table alone and prints how many there are.
do $$
declare
  paid int := 0;
begin
  if to_regclass('public.payments') is null then
    raise notice 'payments: already gone';
    return;
  end if;
  select count(*) into paid from public.payments where status = 'DONE';
  if paid = 0 then
    drop table public.payments;
    raise notice 'payments: dropped (no completed payments)';
  else
    raise notice 'payments: KEPT — % completed payment(s). Keep for 5 years; do not drop.', paid;
  end if;
end $$;

-- 2) pre_registrations — holds contact info of people who pre-registered.
--    Check first, then decide (notify them about launch, or delete):
select count(*) as pre_registrations from public.pre_registrations;
-- To delete (permanent), run this line on its own:
-- drop table if exists public.pre_registrations;
