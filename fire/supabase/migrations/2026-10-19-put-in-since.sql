-- FIRE: a first update's money can be spread from a start date (Put In Since) instead of landing on its own day, for an
-- account tracked late whose You Put In / Employer Put In are totals over years. Null = on the update's own day.
alter table public.fire_updates add column if not exists put_in_since date;
