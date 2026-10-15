-- FIRE: saved projections for milestones. The Overview saves what it projects for each milestone age (at most once a
-- day), so once you reach that age the row can show what was projected beside what you had. Run once in the SQL Editor
-- (a fresh schema.sql already has this).
begin;

create table public.fire_projections (
  age int not null check (age between 1 and 120),
  made_on date not null default current_date,
  projected numeric not null,
  primary key (age, made_on)
);

alter table public.fire_projections enable row level security;
create policy "owner" on public.fire_projections for all to authenticated
  using ((select public.fire_is_owner())) with check ((select public.fire_is_owner()));

commit;
