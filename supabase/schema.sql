-- TEAME Sales Projection
-- Run this in Supabase SQL Editor.
-- It creates the private, persistent one-time item master for each authenticated user.

create table if not exists public.projection_masters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  filename text,
  updated_at timestamptz not null default now(),
  constraint projection_master_size check (octet_length(data::text) <= 25000000)
);

alter table public.projection_masters enable row level security;
revoke all on public.projection_masters from anon;
grant select, insert, update, delete on public.projection_masters to authenticated;

drop policy if exists "Own master only" on public.projection_masters;
create policy "Own master only"
on public.projection_masters
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
