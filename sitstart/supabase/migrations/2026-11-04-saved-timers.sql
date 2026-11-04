-- Saved Hang Timers (the user asked): anyone signed in keeps their own timers to load again and edit. Up to 10 for
-- coaches and admins, 5 for students; the limit is here, not only in the page.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

create table public.saved_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  sets int not null check (sets between 1 and 99),
  reps int not null check (reps between 1 and 99),
  hang int not null check (hang between 1 and 3600),
  gap int check (gap between 1 and 3600),    -- the rest between a set's reps; empty at 1 rep a set
  rest int check (rest between 1 and 3600),  -- the rest between sets; empty at 1 set
  created_at timestamptz not null default now()
);
create unique index saved_timers_name on public.saved_timers (user_id, lower(trim(name)));
alter table public.saved_timers enable row level security;
grant select, insert, update, delete on public.saved_timers to authenticated;

-- Only ever your own: nobody else reads them, coaches included.
create policy "own: read" on public.saved_timers for select to authenticated using (user_id = (select auth.uid()));
create policy "own: add" on public.saved_timers for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own: change" on public.saved_timers for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own: delete" on public.saved_timers for delete to authenticated using (user_id = (select auth.uid()));

-- The lock makes two saves at once wait for each other, so they can't both slip past the count.
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
