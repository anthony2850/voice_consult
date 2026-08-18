-- 결제 퍼널: 리포트 언락 게이트 무결성 보강.
-- 1) order_id 중복 방지 — confirm 재시도가 중복 행을 만들면 maybeSingle()이 에러를 반환해
--    정당한 결제자가 차단된다.
create unique index if not exists payments_order_id_key
  on public.payments (order_id);

-- 2) RLS 확인 — anon 키는 클라이언트 번들에 노출되므로, payments에 anon INSERT가 허용되면
--    브라우저에서 status='DONE' 행을 위조해 페이월을 우회할 수 있다.
--    Supabase 대시보드에서 payments의 RLS가 활성화되어 있고 anon 정책이 없는지 확인할 것.
alter table public.payments enable row level security;
