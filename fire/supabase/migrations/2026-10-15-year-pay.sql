-- FIRE: W-2 totals by year, for years you don't have job and pay details for. One per person per year, or a joint
-- one for both of you (person_id null, e.g. from a joint tax return). Run once in the SQL Editor (a fresh schema.sql
-- already has this).
begin;

create table public.fire_year_pay (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.fire_people (id) on delete cascade,   -- null = both of you together
  year int not null check (year between 1950 and 2200),
  amount numeric not null check (amount >= 0),
  unique nulls not distinct (person_id, year)
);

alter table public.fire_year_pay enable row level security;
create policy "owner" on public.fire_year_pay for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));

commit;
