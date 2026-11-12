-- Persistent activity inbox + owner email outbox. Only future inserts notify.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  kind text not null check (kind in ('lead', 'appointment')),
  entity_id uuid not null,
  title text not null,
  body text not null,
  href text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending', 'sending', 'sent', 'failed', 'uncertain')),
  email_error text,
  email_sent_at timestamptz,
  email_started_at timestamptz,
  unique (kind, entity_id)
);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy "owners read notifications" on public.notifications for select to authenticated using (auth.uid() = owner_id);
create policy "owners mark notifications read" on public.notifications for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index notifications_owner_recent on public.notifications(owner_id, created_at desc);
create index notifications_owner_unread on public.notifications(owner_id, kind) where read_at is null;
create index notifications_pending_email on public.notifications(owner_id, created_at) where email_status = 'pending';

create or replace function public.notify_card_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare card_name text; company uuid; notification_kind text;
begin
  select c.full_name, c.company_id into card_name, company from public.cards c where c.id = new.card_id;
  notification_kind := case when tg_table_name = 'leads' then 'lead' else 'appointment' end;
  insert into public.notifications(owner_id, company_id, kind, entity_id, title, body, href)
  values (new.owner_id, company, notification_kind, new.id,
    case when notification_kind = 'lead' then 'New lead' else 'New appointment' end,
    left(new.name, 100) || case when notification_kind = 'lead' then ' shared their contact with ' else ' booked a meeting with ' end || coalesce(card_name, 'you') || '.',
    case when notification_kind = 'appointment' then '/dashboard/appointments' when company is not null then '/dashboard/company/leads' else '/dashboard/leads' end)
  on conflict (kind, entity_id) do nothing;
  return new;
end; $$;
revoke all on function public.notify_card_owner() from public, anon, authenticated;
grant execute on function public.notify_card_owner() to service_role;
create trigger leads_notify_owner after insert on public.leads for each row execute function public.notify_card_owner();
create trigger appointments_notify_owner after insert on public.appointments for each row execute function public.notify_card_owner();

-- Realtime delivery is optional; the dashboard also polls as a fallback.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end; $$;

-- The linked Google identity is shown to the owner; tokens stay server-only.
alter table public.google_calendar_connections
  add column if not exists google_email text,
  add column if not exists calendar_summary text not null default 'Primary calendar',
  add column if not exists meet_enabled boolean not null default true;
