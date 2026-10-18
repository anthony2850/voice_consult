-- Drop the legacy 990원 report payment funnel.
-- The app no longer has /checkout, /report, /api/payment/confirm or /api/generate-report.
-- Paste this whole file's contents into the Supabase SQL editor and run it.

-- 1) payments — dropped only when it holds no completed (DONE) payments.
--    Real payment records must be kept for 5 years (전자상거래법 시행령 제6조).
do $$
begin
  if to_regclass('public.payments') is not null
     and not exists (select 1 from public.payments where status = 'DONE') then
    drop table public.payments;
  end if;
end $$;

-- 2) Result table.
--    payments_kept = true  → completed payments exist; the table was kept on purpose.
--    pre_registrations      → number of people who pre-registered (contact info). Not deleted.
select
  (to_regclass('public.payments') is not null) as payments_kept,
  (select count(*) from public.pre_registrations) as pre_registrations;

-- To delete the pre-registrations (permanent), run this line on its own:
-- drop table if exists public.pre_registrations;
