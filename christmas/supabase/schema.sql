-- Kiddo Draw: tables, access rules and the shared-login hook.
-- Same Supabase project as Sit Start, Top Out and FIRE: the same logins (auth.users), separate tables (all named xmas_*).
-- Only one login gets in: the email in xmas_owner. Every other login signs in and sees no rows.
-- Run once, after the other apps' schemas: SQL Editor → New query → paste all of this →
-- change the email in step 5 to yours → Run.

begin;

-- 1. Tables ------------------------------------------------------------------

-- The one login that may use Kiddo Draw. Set here in the SQL Editor; the app never changes it.
create table public.xmas_owner (
  id boolean primary key default true check (id),   -- at most one row
  email text not null unique check (email = lower(email))
);

-- The adults who shop and the kids they shop for. Names live here, not in the page, because the site's code is public.
-- active = in this year's draw; turning someone off keeps them in past years.
create table public.xmas_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  kind text not null check (kind in ('adult', 'kid')),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- A saved year: one row per kid, saying which adult has them. A person in a saved year can't be deleted (turn them off instead).
create table public.xmas_picks (
  year int not null check (year between 2000 and 2200),
  kid_id uuid not null references public.xmas_people (id) on delete restrict,
  adult_id uuid not null references public.xmas_people (id) on delete restrict,
  saved_at timestamptz not null default now(),
  primary key (year, kid_id)
);

-- 2. Access ------------------------------------------------------------------

create function public.xmas_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.xmas_owner where email = lower(auth.jwt() ->> 'email'));
$$;
revoke execute on function public.xmas_is_owner() from public, anon;

alter table public.xmas_owner enable row level security;
alter table public.xmas_people enable row level security;
alter table public.xmas_picks enable row level security;

-- The app reads xmas_owner only to know whether you're in. Nobody changes it from the app.
create policy "owner: read" on public.xmas_owner for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

create policy "owner" on public.xmas_people for all to authenticated
  using ((select public.xmas_is_owner())) with check ((select public.xmas_is_owner()));
create policy "owner" on public.xmas_picks for all to authenticated
  using ((select public.xmas_is_owner())) with check ((select public.xmas_is_owner()));

-- 3. Shared logins -----------------------------------------------------------
-- Sit Start asks login_in_other_app() before refusing a sign-up or deleting a login. Top Out's and FIRE's schemas also
-- replace it; this one checks all three other apps' tables. Keep every check if any of those schemas is re-run.
create or replace function public.login_in_other_app(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_staff where email = lower(trim(p_email)))
      or exists (select 1 from public.fire_owner where email = lower(trim(p_email)))
      or exists (select 1 from public.xmas_owner where email = lower(trim(p_email)));
$$;
revoke execute on function public.login_in_other_app(text) from public, anon, authenticated;

-- 4. Shared error log --------------------------------------------------------
alter table public.app_errors drop constraint app_errors_app_check;
alter table public.app_errors add constraint app_errors_app_check check (app in ('sitstart', 'topout', 'fire', 'christmas'));

-- 5. You ----------------------------------------------------------------------
-- Change this to the email you sign in to the other apps with (the same one as FIRE).
insert into public.xmas_owner (email) values (lower('you@example.com'));

commit;
