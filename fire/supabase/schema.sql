-- FIRE: tables, access rules and the shared-login hook.
-- Same Supabase project as Sit Start and Top Out: the same logins (auth.users), separate tables (all named fire_*).
-- Only one login gets in: the email in fire_owner. Every other login signs in and sees no rows.
-- Run once, after Sit Start's and Top Out's schemas: SQL Editor → New query → paste all of this →
-- change the email in step 5 to yours → Run.

begin;

-- 1. Tables ------------------------------------------------------------------

-- The one login that may use FIRE. Set here in the SQL Editor; the app never changes it.
create table public.fire_owner (
  id boolean primary key default true check (id),   -- at most one row
  email text not null unique check (email = lower(email))
);

-- The people the money belongs to (you and your partner). Birth dates turn dates into ages.
create table public.fire_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  birth_date date,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- One row of assumptions. A null column means the app's default (DEFAULTS in settings.js), so Reset to Defaults
-- just sets them all back to null.
create table public.fire_settings (
  id boolean primary key default true check (id),
  real_return numeric check (real_return between -20 and 30),          -- % a year, after inflation
  inflation numeric check (inflation between -10 and 30),              -- % a year
  withdrawal_rate numeric check (withdrawal_rate > 0 and withdrawal_rate <= 20),   -- % of savings spent a year
  retire_age int check (retire_age between 30 and 100),                -- "normal" retirement age
  start_age int check (start_age between 10 and 80),                   -- where salary history starts
  updated_at timestamptz not null default now()
);

-- Jobs: a person can have more than one at a time.
create table public.fire_jobs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.fire_people (id) on delete cascade,
  employer text not null check (length(trim(employer)) between 1 and 80),
  title text not null default '' check (length(title) <= 80),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),   -- null = still there
  notes text not null default '' check (length(notes) <= 2000),
  created_at timestamptz not null default now()
);

-- Pay changes: each rate lasts until the job's next change (or its end date).
-- salary: amount per year. hourly: amount per hour × hours_per_week. none: unpaid (a leave, a gap).
create table public.fire_pay (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.fire_jobs (id) on delete cascade,
  start_date date not null,
  kind text not null check (kind in ('salary', 'hourly', 'none')),
  amount numeric not null default 0 check (amount >= 0),
  hours_per_week numeric check (hours_per_week is null or hours_per_week between 0 and 100),
  check (kind <> 'hourly' or hours_per_week is not null),
  unique (job_id, start_date)
);

-- Bonuses: in dollars, or a percent of the job's yearly rate on that date.
create table public.fire_bonuses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.fire_jobs (id) on delete cascade,
  paid_on date not null,
  amount numeric check (amount is null or amount >= 0),
  percent numeric check (percent is null or percent between 0 and 1000),
  note text not null default '' check (length(note) <= 200),
  check ((amount is null) <> (percent is null))
);

-- What a job actually paid in a year (the W-2). It replaces the estimate from the pay rates.
create table public.fire_job_actuals (
  job_id uuid not null references public.fire_jobs (id) on delete cascade,
  year int not null check (year between 1950 and 2200),
  amount numeric not null check (amount >= 0),
  primary key (job_id, year)
);

-- Accounts: 401(k)s, IRAs, HSAs, brokerage. owner_id null = joint.
create table public.fire_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.fire_people (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null check (kind in ('401k', 'roth_401k', '403b', 'ira', 'roth_ira', 'hsa', 'brokerage', 'cash', 'other')),
  institution text not null default '' check (length(institution) <= 80),
  job_id uuid references public.fire_jobs (id) on delete set null,   -- the employer plan's job
  closed_on date,
  notes text not null default '' check (length(notes) <= 2000),
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- A balance on a date, and what went in since the account's previous update.
-- contributed: what you put in. employer: match and profit sharing. moved: money moved in from another of your
-- accounts (a rollover), minus for out. Moved money isn't new savings, so it's kept apart.
create table public.fire_updates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.fire_accounts (id) on delete cascade,
  as_of date not null,
  balance numeric not null check (balance >= 0),
  contributed numeric not null default 0 check (contributed >= 0),
  employer numeric not null default 0 check (employer >= 0),
  moved numeric not null default 0,
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (account_id, as_of)
);
create index on public.fire_updates (account_id, as_of);

-- Household spending, one number a year.
create table public.fire_spending (
  year int primary key check (year between 1950 and 2200),
  amount numeric not null check (amount >= 0)
);

-- 2. Access ------------------------------------------------------------------

create function public.fire_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fire_owner where email = lower(auth.jwt() ->> 'email'));
$$;
revoke execute on function public.fire_is_owner() from public, anon;

alter table public.fire_owner enable row level security;
alter table public.fire_people enable row level security;
alter table public.fire_settings enable row level security;
alter table public.fire_jobs enable row level security;
alter table public.fire_pay enable row level security;
alter table public.fire_bonuses enable row level security;
alter table public.fire_job_actuals enable row level security;
alter table public.fire_accounts enable row level security;
alter table public.fire_updates enable row level security;
alter table public.fire_spending enable row level security;

-- The app reads fire_owner only to know whether you're in. Nobody changes it from the app.
create policy "owner: read" on public.fire_owner for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

create policy "owner" on public.fire_people for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_settings for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_jobs for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_pay for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_bonuses for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_job_actuals for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_accounts for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_updates for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
create policy "owner" on public.fire_spending for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));

-- 3. Shared logins -----------------------------------------------------------
-- Sit Start asks login_in_other_app() before refusing a sign-up or deleting a login. Top Out's schema answers for
-- team_staff; this adds fire_owner, so Sit Start never deletes the FIRE login. Keep both checks if either is re-run.
create or replace function public.login_in_other_app(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_staff where email = lower(trim(p_email)))
      or exists (select 1 from public.fire_owner where email = lower(trim(p_email)));
$$;
revoke execute on function public.login_in_other_app(text) from public, anon, authenticated;

-- 4. Shared error log --------------------------------------------------------
alter table public.app_errors drop constraint app_errors_app_check;
alter table public.app_errors add constraint app_errors_app_check check (app in ('sitstart', 'topout', 'fire'));

-- 5. You ----------------------------------------------------------------------
-- Change this to the email you sign in to Sit Start and Top Out with.
insert into public.fire_owner (email) values (lower('you@example.com'));
insert into public.fire_settings default values;
insert into public.fire_people (name, position) values ('You', 1), ('Partner', 2);

commit;
