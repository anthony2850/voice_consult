-- Drop legacy training records (5-day rotation era).
-- The archive now reads training_sessions only.
-- Run in the Supabase SQL editor. THIS DELETES DATA PERMANENTLY.

drop table if exists public.voice_quality_logs;
drop table if exists public.user_training_logs;

-- Old practice recordings live in the Storage bucket "training-recordings".
-- Supabase blocks deleting storage.objects from SQL; empty and delete the bucket in
-- Dashboard → Storage → training-recordings → (⋯) Empty bucket, then Delete bucket.
