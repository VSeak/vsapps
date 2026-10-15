-- FIRE: contribution plans (what you and your employer put into each account, as a percent of pay or in dollars),
-- and how often each job pays. Run once in the SQL Editor (a fresh schema.sql already has this).
begin;

-- Paychecks a year: 12 monthly, 24 twice a month, 26 every two weeks, 52 weekly.
alter table public.fire_jobs add column paychecks int not null default 24 check (paychecks in (12, 24, 26, 52));

-- One line of a plan: from start_date to end_date (null = still going), you or your employer put in a percent of a
-- job's pay, or dollars per year, month or paycheck (that job's paychecks).
-- A line tied to a job stops when the job ends (the app does that; the job can end after the line was made).
create table public.fire_contributions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.fire_accounts (id) on delete cascade,
  source text not null check (source in ('you', 'employer')),
  kind text not null check (kind in ('percent', 'amount')),
  percent numeric check (percent is null or percent between 0 and 100),
  amount numeric check (amount is null or amount >= 0),
  per text check (per is null or per in ('year', 'month', 'paycheck')),
  job_id uuid references public.fire_jobs (id) on delete set null,   -- whose pay (percent) or paychecks (per paycheck)
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  note text not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now(),
  check ((kind = 'percent' and percent is not null) or (kind = 'amount' and amount is not null and per is not null))
);
create index on public.fire_contributions (account_id);

alter table public.fire_contributions enable row level security;
create policy "owner" on public.fire_contributions for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));

commit;
