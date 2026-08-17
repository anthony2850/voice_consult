-- docs/superpowers/migrations/2026-08-17-pre-registrations-source.sql
-- 결제 퍼널: 사전등록 유입처 구분 (result_card | training_landing)
alter table public.pre_registrations
  add column if not exists source text;
