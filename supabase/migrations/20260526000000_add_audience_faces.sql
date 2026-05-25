create extension if not exists vector;

create table public.audience_faces (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid references public.demos(id) on delete cascade not null,
  name text not null,
  embedding vector(128) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS policies
alter table public.audience_faces enable row level security;

create policy "Users can insert audience faces for their demos"
  on public.audience_faces for insert
  with check (
    demo_id in (
      select id from public.demos where user_id = auth.uid()
    )
  );

create policy "Users can select audience faces for their demos"
  on public.audience_faces for select
  using (
    demo_id in (
      select id from public.demos where user_id = auth.uid()
    )
  );

create policy "Users can update audience faces for their demos"
  on public.audience_faces for update
  using (
    demo_id in (
      select id from public.demos where user_id = auth.uid()
    )
  );

create policy "Users can delete audience faces for their demos"
  on public.audience_faces for delete
  using (
    demo_id in (
      select id from public.demos where user_id = auth.uid()
    )
  );
