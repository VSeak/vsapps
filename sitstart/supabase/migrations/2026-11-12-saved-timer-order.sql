-- Saved Timers keep the order a person drags them into (the user asked); they were A to Z.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

alter table public.saved_timers add column if not exists position int not null default 0;

-- Timers saved before this keep their A to Z order.
update public.saved_timers t set position = r.n
from (select id, row_number() over (partition by user_id order by lower(name)) as n from public.saved_timers) r
where t.id = r.id;

-- A new timer goes at the end. It's done here, under the same lock as the count, so two saves at once can't share a place.
create or replace function public.saved_timers_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  most int := case when public.is_coach() or public.is_admin() then 10 else 5 end;
begin
  perform pg_advisory_xact_lock(hashtextextended('saved_timers' || new.user_id::text, 0));
  if (select count(*) from public.saved_timers where user_id = new.user_id) >= most then
    raise exception 'You can save up to % timers. Delete one to save another.', most;
  end if;
  new.position := coalesce((select max(position) from public.saved_timers where user_id = new.user_id), 0) + 1;
  return new;
end $$;

-- Saves a new order in one call: ids in the order wanted. Runs as the caller, so RLS keeps it to their own timers.
create or replace function public.reorder_saved_timers(ids uuid[]) returns void
language sql set search_path = '' as $$
  update public.saved_timers t set position = o.n
  from unnest(ids) with ordinality as o(id, n)
  where t.id = o.id;
$$;
revoke execute on function public.reorder_saved_timers(uuid[]) from public, anon;
grant execute on function public.reorder_saved_timers(uuid[]) to authenticated;
