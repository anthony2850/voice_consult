-- Training onboarding: store the user's plan (weekly goal, practice time, self-reported concern).
-- Paste this whole file's contents into the Supabase SQL editor and run it.
-- Until this runs, the plan is kept on the user's device only.

alter table public.user_profiles
  add column if not exists plan jsonb;
