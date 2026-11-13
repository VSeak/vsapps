-- PT Pal: tables, the photo bucket, access rules and the shared-login hook.
-- Same Supabase project as Sit Start, Top Out, FIRE, and Kiddo Draw: the same logins (auth.users), separate tables (all named pt_*).
-- Only one login gets in: the email in pt_owner. Every other login signs in and sees no rows and no photo.
-- Run once, after the other apps' schemas (Kiddo Draw's included): SQL Editor → New query → paste all of this →
-- change the email in step 6 to yours → Run.

begin;

-- 1. Tables ------------------------------------------------------------------

-- The one login that may use PT Pal. Set here in the SQL Editor; the app never changes it.
create table public.pt_owner (
  id boolean primary key default true check (id),   -- at most one row
  email text not null unique check (email = lower(email))
);

-- One row: the pal's name, how many daily PT sets make a full day, and when the photo was last changed
-- (null = no photo; the page shows its own drawing). The photo itself is in the pt-photo bucket.
-- lat/lon: where the owner is, rounded to 0.1° (about 10 km), for the window's real sunrise and sunset. Null = not set.
create table public.pt_settings (
  id boolean primary key default true check (id),
  name text not null default 'Pal' check (length(trim(name)) between 1 and 24),
  daily_goal int not null default 2 check (daily_goal between 1 and 10),
  photo_at timestamptz,
  lat numeric(4, 1) check (lat between -90 and 90),
  lon numeric(4, 1) check (lon between -180 and 180),
  -- Which rug the pal stands on (Settings → Rug); null = the braided oval. The page knows the names.
  rug text check (rug ~ '^[a-z]{1,20}$'),
  -- The Christmas Santa hat on the owner's photo, as fractions of it: {x, y} = the middle of its fur band, w = width,
  -- r = tilt in degrees. Null = not placed (no hat on a photo; the fox drawing has its own spot).
  hat jsonb check (hat is null or (jsonb_typeof(hat) = 'object' and length(hat::text) <= 200)),
  -- The year whose New Year "in Berries" screen has been shown (2027 = the 2026 screen). Shown once, on any device.
  year_seen int check (year_seen between 2000 and 3000)
);

-- One row per berry thrown: daily = daily PT (counts toward the streak and the goal), climb = PT done on a climbing day.
create table public.pt_feeds (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily', 'climb')),
  fed_at timestamptz not null default now()
);
create index pt_feeds_fed_at on public.pt_feeds (fed_at);

-- 2. Access ------------------------------------------------------------------

create function public.pt_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pt_owner where email = lower(auth.jwt() ->> 'email'));
$$;
revoke execute on function public.pt_is_owner() from public, anon;

alter table public.pt_owner enable row level security;
alter table public.pt_settings enable row level security;
alter table public.pt_feeds enable row level security;

grant select on public.pt_owner to authenticated;
grant select, insert, update on public.pt_settings to authenticated;
grant select, insert, delete on public.pt_feeds to authenticated;

-- The app reads pt_owner only to know whether you're in. Nobody changes it from the app.
create policy "owner: read" on public.pt_owner for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

create policy "owner" on public.pt_settings for all to authenticated
  using ((select public.pt_is_owner())) with check ((select public.pt_is_owner()));
create policy "owner" on public.pt_feeds for all to authenticated
  using ((select public.pt_is_owner())) with check ((select public.pt_is_owner()));

-- 3. The photo ---------------------------------------------------------------
-- A private bucket holding one file, "pal". Uploading again overwrites it, so an old photo never stays behind.
-- The page shrinks a photo to about 600px before uploading; 2 MB is room to spare.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pt-photo', 'pt-photo', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

-- Overwriting needs read, add and change; Remove Photo needs delete.
create policy "pt owner: read" on storage.objects for select to authenticated
  using (bucket_id = 'pt-photo' and (select public.pt_is_owner()));
create policy "pt owner: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'pt-photo' and name = 'pal' and (select public.pt_is_owner()));
create policy "pt owner: change" on storage.objects for update to authenticated
  using (bucket_id = 'pt-photo' and (select public.pt_is_owner()))
  with check (bucket_id = 'pt-photo' and name = 'pal' and (select public.pt_is_owner()));
create policy "pt owner: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pt-photo' and (select public.pt_is_owner()));

-- 4. Shared logins -----------------------------------------------------------
-- Sit Start asks login_in_other_app() before refusing a sign-up or deleting a login. Top Out's, FIRE's and Kiddo Draw's
-- schemas also replace it; this one checks every other app's table, so it must be the last one run.
create or replace function public.login_in_other_app(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_staff where email = lower(trim(p_email)))
      or exists (select 1 from public.fire_owner where email = lower(trim(p_email)))
      or exists (select 1 from public.xmas_owner where email = lower(trim(p_email)))
      or exists (select 1 from public.pt_owner where email = lower(trim(p_email)));
$$;
revoke execute on function public.login_in_other_app(text) from public, anon, authenticated;

-- 5. Shared error log --------------------------------------------------------
alter table public.app_errors drop constraint app_errors_app_check;
alter table public.app_errors add constraint app_errors_app_check check (app in ('sitstart', 'topout', 'fire', 'christmas', 'pt'));

-- 6. You and the settings row -------------------------------------------------
-- Change this to the email you sign in to the other apps with (the same one as FIRE and Kiddo Draw).
insert into public.pt_owner (email) values (lower('you@example.com'));
insert into public.pt_settings default values;

commit;
