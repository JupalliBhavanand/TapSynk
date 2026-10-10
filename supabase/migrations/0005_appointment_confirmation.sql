-- Historical bookings are not emailed retroactively. New bookings explicitly queue mail.
alter table public.appointments
  add column if not exists booking_language text not null default 'unknown',
  add column if not exists confirmation_email_status text not null default 'not_requested'
    check (confirmation_email_status in ('not_requested', 'pending', 'sending', 'sent', 'failed')),
  add column if not exists confirmation_email_sent_at timestamptz;
create index if not exists appointments_pending_confirmation
  on public.appointments (created_at) where confirmation_email_status = 'pending';
