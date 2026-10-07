-- TapSync v3: scheduled plan switches, lead notes and "Book a demo" requests.
-- Run once in the Supabase SQL editor after 0002_trial_leads_companies.sql.

-- ───────────────────────── plan switches ─────────────────────────
-- Moving from AI Card to Virtual Card waits until the paid period ends, so the
-- customer keeps AI until then. The pending switch is mirrored here for the UI.
alter table public.subscriptions add column if not exists pending_tier text check (pending_tier in ('virtual', 'ai'));
alter table public.subscriptions add column if not exists pending_interval text check (pending_interval in ('month', 'quarter', 'year'));
alter table public.subscriptions add column if not exists pending_change_at timestamptz;
alter table public.subscriptions add column if not exists stripe_schedule_id text;

-- ───────────────────────── lead notes ─────────────────────────
alter table public.leads add column if not exists notes text not null default '' check (char_length(notes) <= 2000);
alter table public.leads add column if not exists updated_at timestamptz not null default now();
create index if not exists leads_company_idx on public.leads (company_id, created_at desc) where company_id is not null;

-- ───────────────────────── demo requests ─────────────────────────
-- Filled in from the public "Book a demo" page. Only the server (service role) reads and
-- writes this table, so it has row-level security on and no policies for signed-in users.
create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  company text not null default '' check (char_length(company) <= 100),
  role text not null default '' check (char_length(role) <= 80),
  team_size text not null default '1' check (team_size in ('1', '2-9', '10-24', '25-99', '100+')),
  interest text not null default 'not_sure' check (interest in ('virtual', 'ai', 'company', 'not_sure')),
  preferred_date date,
  preferred_time text not null default '' check (preferred_time in ('', 'morning', 'afternoon', 'evening')),
  timezone text not null default '' check (char_length(timezone) <= 60),
  message text not null default '' check (char_length(message) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'done', 'not_a_fit')),
  created_at timestamptz not null default now()
);
create index if not exists demo_requests_created_idx on public.demo_requests (created_at desc);
alter table public.demo_requests enable row level security;
