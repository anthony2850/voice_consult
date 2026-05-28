-- Training tab redesign: store user's declared voice concerns.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  concerns text[] not null default '{}',
  concerns_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce concern slugs at the DB level.
alter table public.user_profiles
  drop constraint if exists user_profiles_concerns_check;
alter table public.user_profiles
  add constraint user_profiles_concerns_check
  check (concerns <@ array['small_voice','trembling','fast','diction']::text[]);

-- Row-level security: each user manages their own row.
alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles self read" on public.user_profiles;
create policy "user_profiles self read"
  on public.user_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "user_profiles self upsert" on public.user_profiles;
create policy "user_profiles self upsert"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_profiles self update" on public.user_profiles;
create policy "user_profiles self update"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
