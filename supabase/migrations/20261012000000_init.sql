-- Life balance MVP: areas + logs, scoped per user with RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  color       text,
  floor_type  text not null check (floor_type in ('sessions', 'minutes')),
  floor_value int  not null check (floor_value > 0),
  created_at  timestamptz not null default now()
);

create table public.logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  area_id      uuid not null references public.areas on delete cascade,
  duration_min int  not null check (duration_min > 0),
  energy       smallint check (energy between 1 and 5),
  note         text,
  logged_at    timestamptz not null default now()
);

create index areas_user_id_idx on public.areas (user_id);
create index logs_user_logged_at_idx on public.logs (user_id, logged_at desc);
create index logs_area_id_idx on public.logs (area_id);

grant select, insert, update, delete on public.areas, public.logs to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: users only see and modify their own rows
-- ---------------------------------------------------------------------------

alter table public.areas enable row level security;
alter table public.logs  enable row level security;

-- areas
create policy "areas_select_own" on public.areas
  for select to authenticated
  using (user_id = auth.uid());

create policy "areas_insert_own" on public.areas
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "areas_update_own" on public.areas
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "areas_delete_own" on public.areas
  for delete to authenticated
  using (user_id = auth.uid());

-- logs (writes must also point at an area the user owns)
create policy "logs_select_own" on public.logs
  for select to authenticated
  using (user_id = auth.uid());

create policy "logs_insert_own" on public.logs
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.areas a where a.id = area_id and a.user_id = auth.uid())
  );

create policy "logs_update_own" on public.logs
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.areas a where a.id = area_id and a.user_id = auth.uid())
  );

create policy "logs_delete_own" on public.logs
  for delete to authenticated
  using (user_id = auth.uid());
