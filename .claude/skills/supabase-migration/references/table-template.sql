-- A new table, the vsapps way. Adapted from sitstart/supabase/migrations/2026-11-04-saved-timers.sql.
-- Swap the name, columns, helpers and limits for the app at hand; drop the parts it doesn't need.

-- <What it is, in a sentence> (the user asked): <who keeps them and who can see them>.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

create table public.saved_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  sets int not null check (sets between 1 and 99),
  gap int check (gap between 1 and 3600),    -- a short comment on any column whose meaning isn't obvious
  created_at timestamptz not null default now()
);
-- Unique ignoring case and spaces, so "Max Hang" and "max hang " can't both exist.
create unique index saved_timers_name on public.saved_timers (user_id, lower(trim(name)));

alter table public.saved_timers enable row level security;
grant select, insert, update, delete on public.saved_timers to authenticated;

-- Only ever your own. (select …) runs the check once per query, not once per row.
create policy "own: read" on public.saved_timers for select to authenticated using (user_id = (select auth.uid()));
create policy "own: add" on public.saved_timers for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own: change" on public.saved_timers for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own: delete" on public.saved_timers for delete to authenticated using (user_id = (select auth.uid()));

-- Other access patterns:
--   one owner (FIRE, Kiddo Draw):
--     create policy "owner" on public.fire_x for all to authenticated
--       using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));
--   staff (Top Out):
--     ... using ((select public.team_is_staff()))

-- A limit held in the database, not just the page. The lock makes two saves at once wait for each other,
-- so they can't both slip past the count. The message is what the page shows.
create function public.saved_timers_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  most int := case when public.is_coach() or public.is_admin() then 10 else 5 end;
begin
  perform pg_advisory_xact_lock(hashtextextended('saved_timers' || new.user_id::text, 0));
  if (select count(*) from public.saved_timers where user_id = new.user_id) >= most then
    raise exception 'You can save up to % timers. Delete one to save another.', most;
  end if;
  return new;
end $$;
create trigger saved_timers_limit before insert on public.saved_timers
  for each row execute function public.saved_timers_limit();

-- A function the page calls: lock it down, then open it to signed-in users only.
--   create function public.do_thing(x uuid) returns void
--   language plpgsql security definer set search_path = '' as $$ ... $$;
--   revoke execute on function public.do_thing(uuid) from public, anon;
--   grant execute on function public.do_thing(uuid) to authenticated;
