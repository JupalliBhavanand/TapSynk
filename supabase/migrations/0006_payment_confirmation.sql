-- One durable email record per paid Stripe invoice, shared across webhook retries.
create table if not exists public.payment_confirmation_emails (
  stripe_invoice_id text primary key,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.payment_confirmation_emails enable row level security;
-- Only the service-role webhook can read or modify delivery records.
revoke all on public.payment_confirmation_emails from anon, authenticated;
