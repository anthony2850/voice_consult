-- Voice scene personas: store the sender's scene result with each shared link.
-- Receivers have no acoustic features, so the scene is computed by the sender and saved here.
-- Paste this whole file's contents into the Supabase SQL editor and run it.
-- Until this runs, /api/share saves links without the scene and receivers see an emotion-only result.

alter table public.shared_results
  add column if not exists scene jsonb;
