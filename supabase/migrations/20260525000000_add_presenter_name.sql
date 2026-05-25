-- Add presenter_name column to user_settings.
-- The AI presenter uses this to introduce itself and recognize when an
-- audience member addresses it by name. Empty / null = no name set.
alter table public.user_settings
  add column if not exists presenter_name text;
