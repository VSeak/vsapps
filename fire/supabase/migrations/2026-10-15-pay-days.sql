-- FIRE: pay days on jobs, so pay and paycheck contributions land on the days they're paid. Run once in the SQL Editor
-- (a fresh schema.sql already has this). Both empty = pay is spread evenly over the days, as before.
begin;

-- Monthly or twice a month: the day(s) of the month (a day past the month's end means its last day).
alter table public.fire_jobs add column pay_days int[]
  check (pay_days is null or (cardinality(pay_days) between 1 and 2 and 1 <= all (pay_days) and 31 >= all (pay_days)));
-- Every two weeks or weekly: any one payday; the rest are counted from it.
alter table public.fire_jobs add column pay_anchor date;

commit;
