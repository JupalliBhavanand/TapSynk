-- TapSync v2: free first month, lead capture, analytics events and Company plans.
-- Run once in the Supabase SQL editor after 0001_init.sql.

-- ───────────────────────── free trial ─────────────────────────
-- One free month per account, recorded when the first trial starts.
alter table public.profiles add column if not exists trial_used_at timestamptz;

-- ───────────────────────── companies ─────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  website text not null default '' check (char_length(website) <= 200),
  address text not null default '' check (char_length(address) <= 200),
  logo_url text not null default '',
  accent text not null default '#1d5bff' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  tier text not null default 'virtual' check (tier in ('virtual', 'ai')),
  seats integer not null default 5 check (seats between 2 and 500),
  -- Billing fields are written only by the server (Stripe webhook / service role).
  status text not null default 'incomplete',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;
drop policy if exists "own company read" on public.companies;
create policy "own company read" on public.companies for select using (auth.uid() = owner_id);

-- Cards can now belong to a company. A person still has at most one personal card.
alter table public.cards add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.cards drop constraint if exists cards_user_id_key;
create unique index if not exists cards_one_personal_per_user on public.cards (user_id) where company_id is null;
create index if not exists cards_company_idx on public.cards (company_id) where company_id is not null;

-- Owners may only attach cards to their own company, and never beyond the seats they pay for.
create or replace function public.check_company_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_seats int;
  v_used int;
begin
  if new.company_id is null then
    return new;
  end if;
  select owner_id, seats into v_owner, v_seats from public.companies where id = new.company_id;
  if v_owner is null or v_owner <> new.user_id then
    raise exception 'Card does not belong to this company' using errcode = '42501';
  end if;
  select count(*) into v_used from public.cards where company_id = new.company_id and id <> new.id;
  if v_used >= v_seats then
    raise exception 'All company seats are in use' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists cards_company_check on public.cards;
create trigger cards_company_check
  before insert or update of company_id, user_id on public.cards
  for each row execute function public.check_company_card();

-- A company shares one AI agent across all of its employee cards.
alter table public.ai_agents alter column card_id drop not null;
alter table public.ai_agents add column if not exists company_id uuid unique references public.companies (id) on delete cascade;
alter table public.ai_agents drop constraint if exists ai_agents_owner_check;
alter table public.ai_agents add constraint ai_agents_owner_check check ((card_id is null) <> (company_id is null));

-- Orders can cover many company cards.
alter table public.orders add column if not exists company_id uuid references public.companies (id) on delete set null;
alter table public.orders add column if not exists quantity integer not null default 1;

-- ───────────────────────── leads ─────────────────────────
-- Visitors who share their own details back from a card ("exchange contacts").
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null default '' check (char_length(email) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  company text not null default '' check (char_length(company) <= 100),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  created_at timestamptz not null default now()
);
create index if not exists leads_owner_idx on public.leads (owner_id, created_at desc);
alter table public.leads enable row level security;
drop policy if exists "own leads read" on public.leads;
create policy "own leads read" on public.leads for select using (auth.uid() = owner_id);
drop policy if exists "own leads update" on public.leads;
create policy "own leads update" on public.leads for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "own leads delete" on public.leads;
create policy "own leads delete" on public.leads for delete using (auth.uid() = owner_id);

-- ───────────────────────── analytics events ─────────────────────────
create table if not exists public.card_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  kind text not null check (kind in ('view', 'save', 'ai', 'lead', 'booking')),
  source text not null default 'link' check (source in ('tap', 'qr', 'link')),
  created_at timestamptz not null default now()
);
create index if not exists card_events_owner_idx on public.card_events (owner_id, created_at desc);
create index if not exists card_events_card_idx on public.card_events (card_id, created_at desc);
alter table public.card_events enable row level security;
drop policy if exists "own events read" on public.card_events;
create policy "own events read" on public.card_events for select using (auth.uid() = owner_id);

-- Counters + a dated event row for charts. p_source: tap (card), qr (QR code) or link.
drop function if exists public.bump_card_stat(text, text);
create or replace function public.bump_card_stat(p_slug text, p_kind text, p_source text default 'link')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.cards%rowtype;
begin
  select * into v_card from public.cards where slug = p_slug and published;
  if not found then
    return;
  end if;
  if p_kind = 'view' then
    update public.cards set views = views + 1 where id = v_card.id;
  elsif p_kind = 'save' then
    update public.cards set saves = saves + 1 where id = v_card.id;
  elsif p_kind = 'ai' then
    update public.cards set ai_opens = ai_opens + 1 where id = v_card.id;
  elsif p_kind not in ('lead', 'booking') then
    return;
  end if;
  insert into public.card_events (card_id, owner_id, company_id, kind, source)
  values (v_card.id, v_card.user_id, v_card.company_id, p_kind,
          case when p_source in ('tap', 'qr', 'link') then p_source else 'link' end);
end;
$$;
revoke all on function public.bump_card_stat(text, text, text) from public, anon, authenticated;

-- ───────────────────────── tighter agent ownership ─────────────────────────
-- An agent row may only point at the caller's own card or own company.
drop policy if exists "own agent all" on public.ai_agents;
create policy "own agent all" on public.ai_agents for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (card_id is null or exists (select 1 from public.cards c where c.id = card_id and c.user_id = auth.uid()))
    and (company_id is null or exists (select 1 from public.companies co where co.id = company_id and co.owner_id = auth.uid()))
  );
