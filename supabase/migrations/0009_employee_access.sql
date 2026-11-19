-- Employees sign up using the work email on their company card and verify it.
-- Keep card ownership, billing and the shared agent with the company owner.
begin;

create or replace function public.employee_card_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id
  from public.cards c
  join auth.users u on u.id = auth.uid()
  where u.email_confirmed_at is not null
    and u.email is not null
    and c.company_id is not null
    and lower(btrim(c.email)) = lower(btrim(u.email));
$$;
revoke all on function public.employee_card_ids() from public, anon;
grant execute on function public.employee_card_ids() to authenticated;

drop policy if exists "employee own card read" on public.cards;
create policy "employee own card read" on public.cards for select to authenticated
using (id in (select public.employee_card_ids()));

drop policy if exists "employee own leads read" on public.leads;
create policy "employee own leads read" on public.leads for select to authenticated
using (card_id in (select public.employee_card_ids()));

drop policy if exists "employee own appointments read" on public.appointments;
create policy "employee own appointments read" on public.appointments for select to authenticated
using (card_id in (select public.employee_card_ids()));

-- No employee UPDATE/DELETE policies: personal fields are written by an
-- authenticated server action with a fixed whitelist. Company settings stay private.
create index if not exists cards_employee_email_idx
  on public.cards (lower(btrim(email))) where company_id is not null;

commit;
