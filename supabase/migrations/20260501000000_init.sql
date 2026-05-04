-- Presenter SaaS — initial schema.
-- Tables: profiles, demos, transcripts, kb_documents, kb_chunks, user_settings.
-- Auth: Supabase Auth + RLS (every row scoped to auth.uid()).
-- Vectors: pgvector with HNSW cosine index on kb_chunks.embedding.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_on_signup on auth.users;
create trigger profiles_on_signup
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- demos
-- ----------------------------------------------------------------------------

create table if not exists public.demos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_url text not null,
  language text not null default 'English',
  sections jsonb not null default '[]'::jsonb,
  -- role names only — passwords NEVER persist.
  role_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demos_owner_idx on public.demos(owner_id, created_at desc);

-- ----------------------------------------------------------------------------
-- transcripts (one row per completed demo run)
-- ----------------------------------------------------------------------------

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  demo_id uuid references public.demos(id) on delete set null,
  target_url text not null,
  snapshot jsonb not null,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index if not exists transcripts_owner_idx on public.transcripts(owner_id, created_at desc);
create index if not exists transcripts_demo_idx on public.transcripts(demo_id);

-- ----------------------------------------------------------------------------
-- kb_documents
-- ----------------------------------------------------------------------------

create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- demo_id IS NULL = available to all of this user's demos.
  demo_id uuid references public.demos(id) on delete cascade,
  filename text not null,
  mime text not null,
  size_bytes int not null,
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending','extracting','embedding','ready','failed')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists kb_documents_owner_idx on public.kb_documents(owner_id, created_at desc);
create index if not exists kb_documents_demo_idx on public.kb_documents(demo_id);

-- ----------------------------------------------------------------------------
-- kb_chunks (text + 768-d embedding)
-- ----------------------------------------------------------------------------

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  demo_id uuid references public.demos(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  token_count int,
  embedding vector(768) not null
);
create index if not exists kb_chunks_doc_idx on public.kb_chunks(document_id);
create index if not exists kb_chunks_owner_idx on public.kb_chunks(owner_id);
create index if not exists kb_chunks_embedding_idx on public.kb_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- user_settings
-- ----------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  voice text default 'Puck',
  model_id text,
  persona text,
  default_language text default 'English',
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.demos         enable row level security;
alter table public.transcripts   enable row level security;
alter table public.kb_documents  enable row level security;
alter table public.kb_chunks     enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "self profile"     on public.profiles;
drop policy if exists "owner demos"      on public.demos;
drop policy if exists "owner transcripts" on public.transcripts;
drop policy if exists "owner kb_documents" on public.kb_documents;
drop policy if exists "owner kb_chunks"  on public.kb_chunks;
drop policy if exists "self settings"    on public.user_settings;

create policy "self profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "owner demos" on public.demos
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner transcripts" on public.transcripts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner kb_documents" on public.kb_documents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner kb_chunks" on public.kb_chunks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "self settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Retrieval RPC: ANN search bound to caller (user-wide + demo-scoped union)
-- ----------------------------------------------------------------------------

create or replace function public.match_kb_chunks(
  query_embedding vector(768),
  match_count int,
  p_demo_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.kb_chunks c
  where c.owner_id = auth.uid()
    and (p_demo_id is null or c.demo_id is null or c.demo_id = p_demo_id)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ----------------------------------------------------------------------------
-- Storage bucket for KB uploads
-- (run once; Supabase Storage policies live in storage.objects)
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('kb-uploads', 'kb-uploads', false)
on conflict (id) do nothing;

drop policy if exists "kb owner read"   on storage.objects;
drop policy if exists "kb owner write"  on storage.objects;
drop policy if exists "kb owner update" on storage.objects;
drop policy if exists "kb owner delete" on storage.objects;

create policy "kb owner read" on storage.objects
  for select using (
    bucket_id = 'kb-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "kb owner write" on storage.objects
  for insert with check (
    bucket_id = 'kb-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "kb owner update" on storage.objects
  for update using (
    bucket_id = 'kb-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "kb owner delete" on storage.objects
  for delete using (
    bucket_id = 'kb-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
