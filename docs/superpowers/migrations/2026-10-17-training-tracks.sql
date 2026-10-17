-- Training tracks: one concern, one ladder.
-- Spec: docs/superpowers/specs/2026-10-17-training-track-design.md
-- Run in the Supabase SQL editor.

-- ── user_profiles: scene + current track ─────────────────────────────────────
alter table public.user_profiles
  add column if not exists scene text,
  add column if not exists track_concern text,
  add column if not exists track_rung smallint,
  add column if not exists track_started_at timestamptz,
  add column if not exists baseline jsonb;

alter table public.user_profiles
  drop constraint if exists user_profiles_scene_check;
alter table public.user_profiles
  add constraint user_profiles_scene_check
  check (scene is null or scene in ('interview','presentation','call','daily'));

alter table public.user_profiles
  drop constraint if exists user_profiles_track_concern_check;
alter table public.user_profiles
  add constraint user_profiles_track_concern_check
  check (track_concern is null or track_concern in ('small_voice','trembling','fast','diction'));

alter table public.user_profiles
  drop constraint if exists user_profiles_track_rung_check;
alter table public.user_profiles
  add constraint user_profiles_track_rung_check
  check (track_rung is null or (track_rung between 1 and 6));

-- ── training_sessions: observation journal (4교시 54·55쪽) ───────────────────
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  session_date date not null default current_date,
  kind text not null check (kind in ('diagnosis','session')),
  -- 상태·과제·환경
  concern text check (concern is null or concern in ('small_voice','trembling','fast','diction')),
  scene text check (scene is null or scene in ('interview','presentation','call','daily')),
  rung smallint check (rung is null or (rung between 1 and 6)),
  session_index integer,
  voice_use text check (voice_use is null or voice_use in ('low','normal','high')),
  variation_id text,
  -- 실제 행동 (측정)
  retention jsonb,
  performance jsonb,
  rung_measures jsonb,
  -- 비용·판단·다음
  effort smallint check (effort is null or (effort between 1 and 5)),
  pain boolean not null default false,
  met_criterion boolean,
  next_rung smallint check (next_rung is null or (next_rung between 1 and 6)),
  note text
);

create index if not exists training_sessions_user_created_idx
  on public.training_sessions (user_id, created_at desc);

alter table public.training_sessions enable row level security;

drop policy if exists "training_sessions self read" on public.training_sessions;
create policy "training_sessions self read"
  on public.training_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "training_sessions self insert" on public.training_sessions;
create policy "training_sessions self insert"
  on public.training_sessions for insert
  with check (auth.uid() = user_id);
