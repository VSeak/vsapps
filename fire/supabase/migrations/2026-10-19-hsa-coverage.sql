-- FIRE: HSA coverage for the contribution limits card (self-only or family). Null or false = self-only.
alter table public.fire_settings add column if not exists hsa_family boolean;
