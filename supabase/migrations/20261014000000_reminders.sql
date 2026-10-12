-- Planned items, optionally tied to an area, with an optional local-notification lead time.

create table public.reminders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  area_id           uuid references public.areas on delete set null,
  title             text not null,
  due_at            timestamptz not null,
  planned_min       int check (planned_min > 0),
  notify_before_min int check (notify_before_min >= 0), -- null = no notification
  done_at           timestamptz,
  log_id            uuid references public.logs on delete set null,
  created_at        timestamptz not null default now()
);

create index reminders_user_due_idx on public.reminders (user_id, due_at);

grant select, insert, update, delete on public.reminders to authenticated;

alter table public.reminders enable row level security;

create policy "reminders_select_own" on public.reminders
  for select to authenticated
  using (user_id = auth.uid());

-- writes may only point at the user's own area and log
create policy "reminders_insert_own" on public.reminders
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (area_id is null or exists (select 1 from public.areas a where a.id = area_id and a.user_id = auth.uid()))
    and (log_id is null or exists (select 1 from public.logs l where l.id = log_id and l.user_id = auth.uid()))
  );

create policy "reminders_update_own" on public.reminders
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (area_id is null or exists (select 1 from public.areas a where a.id = area_id and a.user_id = auth.uid()))
    and (log_id is null or exists (select 1 from public.logs l where l.id = log_id and l.user_id = auth.uid()))
  );

create policy "reminders_delete_own" on public.reminders
  for delete to authenticated
  using (user_id = auth.uid());
