-- Project Circuit on a check-in (the user asked, 2026-10-30): the color where most of the member's projects are, beside
-- Hardest Circuit (the hardest they've sent, even once). It can be below Hardest when those sends were one-offs.
-- Deleting a circuit clears it here too, like Hardest Circuit. Safe to run again.
alter table public.team_checkins add column if not exists project_circuit_id uuid
  references public.team_circuits (id) on delete set null;
