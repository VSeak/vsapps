-- The new Focus Area list with sub-areas (the user's revamp, 2026-10-14). Run after 2026-10-14-sub-areas.sql.
-- Areas already there keep their id, ratings and Focus Area Ratings lines; Volume goes (Endurance covers it); new
-- areas and sub-areas are added. Safe to run again.
begin;

delete from public.team_rating_areas where name_key = 'volume';

-- Areas: name, group, rated, order within the list.
insert into public.team_rating_areas (name, area_group, rated, position) values
  ('Footwork',          'skill',    true,  1),
  ('Technique',         'skill',    true,  2),
  ('Dynamic Movement',  'skill',    true,  3),
  ('Hold Types',        'skill',    true,  4),
  ('Wall Angles',       'skill',    true,  5),
  ('Route Reading',     'skill',    true,  6),
  ('Strength',          'physical', true,  7),
  ('Power',             'physical', true,  8),
  ('Endurance',         'physical', true,  9),
  ('Flexibility',       'physical', false, 10),
  ('Injury Prevention', 'physical', false, 11),
  ('Mental Game',       'mental',   true,  12),
  ('Projecting',        'mental',   true,  13),
  ('Comp Prep',         'mental',   false, 14)
on conflict (name_key) do update set area_group = excluded.area_group, rated = excluded.rated, position = excluded.position,
  parent_id = null, active = true;

-- Sub-areas: area, name, order within the area. Group and Rated come from the area (team_area_parent).
insert into public.team_rating_areas (name, position, parent_id)
select s.name, s.n, p.id
from (values
  ('Footwork', 'Precise Placement', 1), ('Footwork', 'Quiet Feet', 2), ('Footwork', 'Edging', 3), ('Footwork', 'Smearing', 4),
  ('Footwork', 'Heel Hooks', 5), ('Footwork', 'Toe Hooks', 6), ('Footwork', 'Foot Swaps & Matching', 7),
  ('Technique', 'Hip Position', 1), ('Technique', 'Flagging', 2), ('Technique', 'Drop Knees', 3), ('Technique', 'Twist-Locks', 4),
  ('Technique', 'Straight Arms', 5),
  ('Dynamic Movement', 'Deadpoints', 1), ('Dynamic Movement', 'Dynos', 2), ('Dynamic Movement', 'Coordination', 3),
  ('Dynamic Movement', 'Catching Swings', 4),
  ('Hold Types', 'Crimps', 1), ('Hold Types', 'Slopers', 2), ('Hold Types', 'Pinches', 3), ('Hold Types', 'Pockets', 4),
  ('Hold Types', 'Underclings & Gastons', 5),
  ('Wall Angles', 'Slab', 1), ('Wall Angles', 'Vertical', 2), ('Wall Angles', 'Overhang', 3), ('Wall Angles', 'Roof', 4),
  ('Route Reading', 'Spotting Key Holds', 1), ('Route Reading', 'Visualizing Sequences', 2), ('Route Reading', 'Flashing', 3),
  ('Strength', 'Finger Strength', 1), ('Strength', 'Pulling', 2), ('Strength', 'Lock-Offs', 3), ('Strength', 'Core & Body Tension', 4),
  ('Strength', 'Compression', 5),
  ('Power', 'Contact Strength', 1), ('Power', 'Explosive Pull', 2), ('Power', 'Campusing', 3),
  ('Endurance', 'Power Endurance', 1), ('Endurance', 'Recovery Between Attempts', 2), ('Endurance', 'Session Stamina', 3),
  ('Flexibility', 'Hips', 1), ('Flexibility', 'Hamstrings', 2), ('Flexibility', 'Shoulders', 3), ('Flexibility', 'High Steps', 4),
  ('Injury Prevention', 'Warm-Up', 1), ('Injury Prevention', 'Antagonist Training', 2), ('Injury Prevention', 'Finger Care', 3),
  ('Injury Prevention', 'Shoulder Health', 4), ('Injury Prevention', 'Skin Care', 5), ('Injury Prevention', 'Rest & Sleep', 6),
  ('Mental Game', 'Commitment', 1), ('Mental Game', 'Fear of Falling', 2), ('Mental Game', 'Confidence', 3), ('Mental Game', 'Focus', 4),
  ('Mental Game', 'Bouncing Back', 5),
  ('Projecting', 'Breaking Down Problems', 1), ('Projecting', 'Patience', 2), ('Projecting', 'Tactics', 3), ('Projecting', 'Goal Setting', 4),
  ('Comp Prep', 'Time Limits', 1), ('Comp Prep', 'Isolation & Routine', 2), ('Comp Prep', 'Scoring Strategy', 3),
  ('Comp Prep', 'Reading Under Pressure', 4)
) as s (area, name, n)
join public.team_rating_areas p on p.name_key = lower(s.area) and p.parent_id is null
on conflict (name_key) do update set parent_id = excluded.parent_id, position = excluded.position, active = true;

commit;
