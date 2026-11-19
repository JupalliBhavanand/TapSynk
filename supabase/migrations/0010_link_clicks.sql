-- Outbound profile clicks are separate from existing card view/save metrics.
begin;
create table public.link_clicks (
  id uuid primary key,
  card_id uuid not null references public.cards(id) on delete cascade,
  link_id text not null check (char_length(link_id) between 1 and 80),
  link_label text not null check (char_length(link_label) between 1 and 100),
  link_url text not null check (char_length(link_url) between 1 and 2048),
  clicked_at timestamptz not null default clock_timestamp(),
  source text not null default 'unknown' check (source in ('nfc', 'qr', 'link', 'unknown')),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  user_agent text check (char_length(user_agent) <= 512),
  referrer text check (char_length(referrer) <= 512)
);
create index link_clicks_card_time_idx on public.link_clicks(card_id, clicked_at desc);
create index link_clicks_dedupe_idx on public.link_clicks(card_id, link_id, visitor_hash, clicked_at desc);
alter table public.link_clicks enable row level security;
revoke all on public.link_clicks from anon, authenticated;
grant select on public.link_clicks to authenticated;
grant all on public.link_clicks to service_role;
-- Derive access from current ownership, never from publicly readable card status.
create policy "card owners and company managers read link clicks"
on public.link_clicks for select to authenticated using (
  exists (select 1 from public.cards c where c.id = card_id and (
    c.user_id = auth.uid() or exists (
      select 1 from public.companies co where co.id = c.company_id and co.owner_id = auth.uid()
    )
  ))
);

create function public.record_link_click(
  p_event_id uuid, p_card_id uuid, p_link_id text, p_link_label text, p_link_url text,
  p_source text, p_visitor_hash text, p_user_agent text, p_referrer text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.cards where id = p_card_id and published) then return false; end if;
  -- Serializes only this visitor/link. Suppression works across server instances.
  perform pg_advisory_xact_lock(hashtextextended(p_card_id::text || ':' || p_link_id || ':' || p_visitor_hash, 0));
  if exists(select 1 from public.link_clicks where card_id = p_card_id and link_id = p_link_id
    and visitor_hash = p_visitor_hash and clicked_at > clock_timestamp() - interval '2 seconds') then return false; end if;
  insert into public.link_clicks(id, card_id, link_id, link_label, link_url, source, visitor_hash, user_agent, referrer)
  values(p_event_id, p_card_id, p_link_id, p_link_label, p_link_url, p_source, p_visitor_hash, p_user_agent, p_referrer)
  on conflict(id) do nothing;
  return found;
end;
$$;
revoke all on function public.record_link_click(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_link_click(uuid, uuid, text, text, text, text, text, text, text) to service_role;

-- One JSON result avoids PostgREST's row limit truncating large team reports.
-- SECURITY INVOKER is essential: the caller's SELECT policy applies to every row.
create function public.link_click_totals(p_card_ids uuid[], p_since timestamptz default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select card_id, link_id, link_url, count(*) as clicks
    from public.link_clicks
    where card_id = any(p_card_ids) and (p_since is null or clicked_at >= p_since)
    group by card_id, link_id, link_url
  ) t;
$$;
revoke all on function public.link_click_totals(uuid[], timestamptz) from public, anon;
grant execute on function public.link_click_totals(uuid[], timestamptz) to authenticated;
commit;
