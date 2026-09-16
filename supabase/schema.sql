-- Run once in the Supabase SQL Editor.
create table if not exists public.projection_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"sales":[],"master":[],"salesName":"","masterName":""}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint workspace_size check (octet_length(data::text) <= 25000000)
);
alter table public.projection_workspaces enable row level security;
revoke all on public.projection_workspaces from anon;
grant select, insert, update, delete on public.projection_workspaces to authenticated;
drop policy if exists "Own workspace only" on public.projection_workspaces;
create policy "Own workspace only" on public.projection_workspaces for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
