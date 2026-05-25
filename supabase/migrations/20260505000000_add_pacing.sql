-- Add pacing column to user_settings.
-- Values: 'slow', 'moderate', 'fast'. Default: 'moderate'.
alter table public.user_settings
  add column if not exists pacing text not null default 'moderate'
  check (pacing in ('slow', 'moderate', 'fast'));
