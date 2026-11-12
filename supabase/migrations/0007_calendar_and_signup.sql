-- Duplicate signup checks are available only to trusted server code.
create or replace function public.account_email_exists(candidate text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from auth.users where lower(email) = lower(trim(candidate))); $$;
revoke all on function public.account_email_exists(text) from public, anon, authenticated;
grant execute on function public.account_email_exists(text) to service_role;

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  granted_scope text not null,
  connected_at timestamptz not null default now(),
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.google_calendar_connections enable row level security;
-- Tokens are never readable by browsers, including the account owner.
revoke all on public.google_calendar_connections from anon, authenticated;
grant all on public.google_calendar_connections to service_role;

alter table public.appointments
  add column if not exists google_event_id text,
  add column if not exists google_meet_url text,
  add column if not exists google_event_version integer not null default 1,
  add column if not exists calendar_sync_status text not null default 'pending'
    check (calendar_sync_status in ('pending', 'synced', 'failed', 'disconnected')),
  add column if not exists calendar_sync_error text;

-- Reopened bookings get a fresh Google event ID; deleted Calendar events cannot
-- safely reuse the ID of an earlier cancelled event.
create or replace function public.queue_calendar_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    new.calendar_sync_status := 'pending';
    new.calendar_sync_error := null;
    if old.status = 'cancelled' and new.status = 'confirmed' then
      new.google_event_version := old.google_event_version + 1;
      new.google_event_id := null;
      new.google_meet_url := null;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists appointments_queue_calendar on public.appointments;
create trigger appointments_queue_calendar before update on public.appointments
  for each row execute function public.queue_calendar_change();
create index if not exists appointments_calendar_pending on public.appointments(owner_id, starts_at)
  where calendar_sync_status in ('pending', 'failed');
