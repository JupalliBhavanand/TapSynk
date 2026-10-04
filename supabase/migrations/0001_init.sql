-- TapSync schema: run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ───────────────────────── profiles ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── cards ─────────────────────────
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  full_name text not null default '' check (char_length(full_name) <= 80),
  job_title text not null default '' check (char_length(job_title) <= 80),
  company text not null default '' check (char_length(company) <= 80),
  bio text not null default '' check (char_length(bio) <= 400),
  email text not null default '' check (char_length(email) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  website text not null default '' check (char_length(website) <= 200),
  address text not null default '' check (char_length(address) <= 200),
  avatar_url text not null default '',
  logo_url text not null default '',
  accent text not null default '#2563EB' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  socials jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  first_printed_at timestamptz,
  views integer not null default 0,
  saves integer not null default 0,
  ai_opens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── AI agents ─────────────────────────
create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references public.cards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null default '',
  description text not null default '' check (char_length(description) <= 4000),
  services text not null default '' check (char_length(services) <= 4000),
  faq text not null default '' check (char_length(faq) <= 6000),
  tone text not null default 'friendly' check (tone in ('friendly', 'professional', 'enthusiastic', 'concise')),
  website_url text not null default '',
  knowledge text not null default '' check (char_length(knowledge) <= 30000),
  knowledge_updated_at timestamptz,
  booking_enabled boolean not null default true,
  timezone text not null default 'UTC',
  work_days int[] not null default '{1,2,3,4,5}',
  day_start time not null default '09:00',
  day_end time not null default '17:00',
  slot_minutes int not null default 30 check (slot_minutes in (15, 30, 45, 60, 90)),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── appointments ─────────────────────────
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  notes text not null default '' check (char_length(notes) <= 1000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);
-- Never double-book a confirmed slot on the same card.
create unique index if not exists appointments_no_double_booking
  on public.appointments (card_id, starts_at) where status = 'confirmed';

-- ───────────────────────── billing ─────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  tier text not null check (tier in ('virtual', 'ai')),
  billing_interval text not null check (billing_interval in ('month', 'quarter', 'year')),
  status text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_session_id text not null unique,
  receipt_number text not null,
  tier text not null,
  billing_interval text not null,
  amount_subtotal integer not null default 0,
  amount_discount integer not null default 0,
  amount_tax integer not null default 0,
  amount_total integer not null default 0,
  currency text not null default 'usd',
  card_brand text,
  card_last4 text,
  shipping_name text,
  shipping_address jsonb,
  fulfillment_status text not null default 'processing'
    check (fulfillment_status in ('processing', 'printing', 'shipped', 'delivered')),
  created_at timestamptz not null default now()
);

-- ───────────────────────── rate limiting ─────────────────────────
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- Public card counters (views / contact saves / AI opens).
create or replace function public.bump_card_stat(p_slug text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'view' then
    update public.cards set views = views + 1 where slug = p_slug and published;
  elsif p_kind = 'save' then
    update public.cards set saves = saves + 1 where slug = p_slug and published;
  elsif p_kind = 'ai' then
    update public.cards set ai_opens = ai_opens + 1 where slug = p_slug and published;
  end if;
end;
$$;
revoke all on function public.bump_card_stat(text, text) from public, anon, authenticated;

-- ───────────────────────── row level security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.ai_agents enable row level security;
alter table public.appointments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.rate_limits enable row level security;

create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Owners manage their card; anyone may read a published card.
create policy "own card all" on public.cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published cards are public" on public.cards for select using (published);

-- Agent config is private; the public chat reads it server-side with the service role.
create policy "own agent all" on public.ai_agents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Visitors book through the server (service role); owners read and update.
create policy "own appointments read" on public.appointments for select using (auth.uid() = owner_id);
create policy "own appointments update" on public.appointments for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Billing rows are written only by the Stripe webhook (service role).
create policy "own subscription read" on public.subscriptions for select using (auth.uid() = user_id);
create policy "own orders read" on public.orders for select using (auth.uid() = user_id);

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-assets', 'card-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "card assets public read" on storage.objects for select using (bucket_id = 'card-assets');
create policy "card assets owner write" on storage.objects for insert
  with check (bucket_id = 'card-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card assets owner update" on storage.objects for update
  using (bucket_id = 'card-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card assets owner delete" on storage.objects for delete
  using (bucket_id = 'card-assets' and (storage.foldername(name))[1] = auth.uid()::text);
