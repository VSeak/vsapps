-- Rankings and levels (another coach's feedback, 2026-10-30):
--   * Sub-areas go. A sub-area tag on a practice, Team Focus or check-in becomes its area, then the sub-areas are deleted.
--   * Focus Area descriptions become a 1–10 ladder (reference only), so `guide` holds 0 or 10 lines.
--   * Check-ins drop the 1–5 ratings (member's and coach's) for `ranking`: the member's Rated areas, strongest first.
--   * Levels (Recreational, Intermediate, Advanced, Open), a list admins edit in Settings; each check-in records one.
-- No real ratings were saved yet (the user said), so they are dropped, not converted. Safe to run again.
begin;

-- ---------- Sub-areas out ----------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_rating_areas' and column_name = 'parent_id') then
    -- A tag on a sub-area becomes a tag on its area (team_area_cleanup would otherwise just drop it).
    update public.team_practices p set area_ids = (select coalesce(array_agg(distinct coalesce(a.parent_id, x)), '{}')
      from unnest(p.area_ids) x left join public.team_rating_areas a on a.id = x);
    update public.team_focus f set area_ids = (select coalesce(array_agg(distinct coalesce(a.parent_id, x)), '{}')
      from unnest(f.area_ids) x left join public.team_rating_areas a on a.id = x);
    update public.team_checkins c set tags = coalesce((select jsonb_object_agg(e.key,
        (select coalesce(jsonb_agg(distinct coalesce(a.parent_id::text, t)), '[]') from jsonb_array_elements_text(e.value) t
           left join public.team_rating_areas a on a.id::text = t))
      from jsonb_each(c.tags) e), '{}')
    where c.tags <> '{}';
    delete from public.team_rating_areas where parent_id is not null;
    drop trigger if exists team_area_children on public.team_rating_areas;
    drop trigger if exists team_area_parent on public.team_rating_areas;
    drop function if exists public.team_area_children();
    drop function if exists public.team_area_parent();
    alter table public.team_rating_areas drop column parent_id;   -- its index goes with it
  end if;
end $$;

-- ---------- Levels ----------
-- The team's levels, easiest first. `about` says who fits (the circuits they climb), shown under the pick on a check-in.
create table if not exists public.team_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 30),
  name_key text generated always as (lower(trim(name))) stored unique,
  about text not null default '' check (length(about) <= 120),
  position int not null
);
alter table public.team_levels enable row level security;
drop policy if exists "staff: read" on public.team_levels;
drop policy if exists "admin: everything" on public.team_levels;
create policy "staff: read" on public.team_levels for select to authenticated using ((select public.team_is_staff()));
create policy "admin: everything" on public.team_levels for all to authenticated
  using ((select public.team_is_admin())) with check ((select public.team_is_admin()));
insert into public.team_levels (name, about, position) values
  ('Recreational', 'Yellow, Red, Green', 1),
  ('Intermediate', 'Purple, Orange, Black', 2),
  ('Advanced',     'Black, Blue, Pink', 3),
  ('Open',         'Blue, Pink, White, Mint', 4)
on conflict (name_key) do nothing;

-- ---------- Check-ins: ranking and level ----------
-- ranking = ["<area id>", …], the member's Rated areas from strongest to weakest (their own view; the coach drags it for them).
alter table public.team_checkins add column if not exists ranking jsonb not null default '[]' check (jsonb_typeof(ranking) = 'array');
alter table public.team_checkins add column if not exists level_id uuid references public.team_levels (id) on delete set null;

-- Deleting an area takes it off rankings, tags, Team Focus and practices.
create or replace function public.team_area_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text := old.id::text;
begin
  update public.team_checkins c set
    ranking = c.ranking - k,
    tags = coalesce((select jsonb_object_agg(e.key, e.value - k) from jsonb_each(c.tags) e
                     where jsonb_array_length(e.value - k) > 0), '{}')
  where c.ranking ? k or exists (select 1 from jsonb_each(c.tags) e where e.value ? k);
  update public.team_focus set area_ids = array_remove(area_ids, old.id) where old.id = any (area_ids);
  update public.team_practices set area_ids = array_remove(area_ids, old.id) where old.id = any (area_ids);
  return old;
end;
$$;
alter table public.team_checkins drop column if exists ratings;
alter table public.team_checkins drop column if exists coach_ratings;

-- ---------- 1–10 descriptions ----------
alter table public.team_rating_areas drop constraint if exists team_rating_areas_guide_check;
update public.team_rating_areas a set guide = g.lines from (values
  ('footwork', array[
    'Feet cut or scrape on most moves; looks only at hands; won''t trust a smear.',
    'Starting to look at feet before moving; still scrapes and cuts often.',
    'Places feet on purpose, but often readjusts; edges feel fine.',
    'Edges on most footholds without readjusting; smears and hooks still feel unsure.',
    'Precise and quiet on most holds at their level.',
    'Precise and quiet at their level; hooks heels and toes on obvious spots.',
    'Precise on small footholds near their limit; starting to smear and swap feet when needed.',
    'Precise on small holds at their limit; smears, hooks and swaps feet when the climb needs it.',
    'Feet drive most of their climbing; finds footholds and hooks others miss on familiar styles.',
    'Feet drive the climbing in any style; finds and uses footholds and hooks others miss.']),
  ('technique', array[
    'Climbs square to the wall with bent arms; hips stay far from the wall.',
    'Starting to turn a hip in on easy climbs; arms still bent most of the time.',
    'Knows flagging and drop knees, but uses them only when reminded.',
    'Flags and drop knees on easy climbs without being told.',
    'Turns hips and flags on most climbs at their level.',
    'Turns hips and flags well at their level; climbs with straight arms when they can.',
    'Picks good body positions on harder climbs; still wastes energy on unfamiliar styles.',
    'Picks the right body position on harder and unfamiliar climbs; rarely wastes energy.',
    'Moves efficiently in most styles; drop knees and twist-locks come naturally.',
    'Moves efficiently in any style; flags, drop knees and twist-locks come without thinking.']),
  ('dynamic movement', array[
    'Climbs statically only; avoids any move that needs momentum.',
    'Uses a little momentum on easy moves; avoids anything that leaves the wall.',
    'Tries deadpoints and short lunges; timing is off and feet often cut loose.',
    'Sticks short deadpoints on good holds; lunges still feel random.',
    'Sticks deadpoints and standard dynos at their level.',
    'Sticks deadpoints and dynos at their level and controls the swing.',
    'Hits bigger dynos with good power; coordination moves still stop them.',
    'Hits big dynos with power; only poor finishing holds or coordination moves stop them.',
    'Sticks run-and-jumps and simple coordination moves.',
    'Sticks run-and-jumps and multi-step coordination moves; holds the swing on any catch.']),
  ('route reading', array[
    'Starts climbing without a plan; works out every move on the wall.',
    'Looks at the start before climbing; works out the rest on the wall.',
    'Plans the first few moves; often misses key holds or the crux.',
    'Plans most of the climb; still misreads the crux sequence often.',
    'Reads most climbs at their level before starting.',
    'Reads most climbs at their level before starting; spots the key holds and the crux.',
    'Visualizes whole sequences on harder climbs; sometimes flashes at their level.',
    'Visualizes whole sequences on harder climbs; often flashes at their level.',
    'Reads hard climbs accurately; their first-go beta usually works on familiar styles.',
    'Reads hard and unusual climbs accurately; their first-go beta is usually right.']),
  ('strength', array[
    'Struggles to hold small edges or pull through steep moves; body sags off the wall.',
    'Holds jugs on steep climbs for a few moves; small edges still shut them down.',
    'Holds good edges; small holds, lock-offs or steep climbs shut them down.',
    'Holds small edges on vertical walls; lock-offs and steep climbs still shut them down.',
    'Strength roughly matches their grade.',
    'Strength matches their grade; rarely the main reason they fall.',
    'Strength lets them try climbs a little above their grade.',
    'Strength lets them try climbs above their grade; holds tension and squeezes well.',
    'Strong on most holds and angles; locks off and keeps tension well.',
    'Strong on any hold and angle; locks off, squeezes and keeps tension with ease.']),
  ('power', array[
    'Moves slowly between holds; can''t generate speed for a far move.',
    'Moves a bit faster on jugs; far moves are still out of reach.',
    'Moves fast on good holds; small holds or long moves are too much.',
    'Moves fast on most good holds; starting to latch smaller holds.',
    'Explosive enough for most powerful moves at their level.',
    'Explosive enough for the powerful moves at their level.',
    'Latches small holds fast; big moves above their grade sometimes go.',
    'Latches small holds fast and pulls through big moves above their grade.',
    'Explosive on most holds; simple campus moves go.',
    'Explosive on any hold; campus-style moves are a strength.']),
  ('endurance', array[
    'Pumped or tired after a few climbs; needs long rests.',
    'Lasts several climbs before needing a long rest.',
    'Lasts part of a session; quality drops fast and they recover slowly between tries.',
    'Lasts most of a session; quality drops off near the end.',
    'Climbs a full session at a steady level.',
    'Climbs a full session at a steady level; recovers between tries.',
    'Strong through long sessions; long problems still pump them out.',
    'Strong through long sessions, long problems and back-to-back tries.',
    'Barely fades in a session; many hard tries in a row.',
    'Barely fades; many hard tries in a session or a comp round.']),
  ('flexibility', array[
    'Stiff hips and hamstrings; high steps and wide moves are out of reach.',
    'Gets a foot to waist height with effort, but can''t keep hips close while doing it.',
    'High steps work on easy climbs; wide stems and drop knees feel strained.',
    'High steps and drop knees work on easy climbs without strain.',
    'Mobility is enough for most moves at their level.',
    'Mobility rarely limits them at their level; high steps and stems feel natural.',
    'Rocks over high feet and heel hooks above the waist on harder climbs.',
    'High heel hooks, wide stems and rock-overs work near their limit.',
    'Flexibility opens up beta others can''t use on most climbs.',
    'Flexibility is a strength: high heels, wide stems and rock-overs on any climb.']),
  ('mental game', array[
    'Hesitates or backs off when scared, pumped or watched.',
    'Commits on easy climbs; backs off when it gets high or hard.',
    'Commits on familiar climbs; nerves or a fall throw them off.',
    'Commits on most familiar climbs; recovers after a fall, given time.',
    'Commits on most climbs at their level.',
    'Commits on most climbs at their level; bounces back after falls.',
    'Calm and focused at their limit; comps or high moves still rattle them sometimes.',
    'Calm and focused at their limit, in comps and on high or scary moves.',
    'Handles pressure well; commits fully on most hard moves.',
    'Thrives under pressure; commits fully and makes good decisions when it counts.']),
  ('hold types', array[
    'Comfortable only on jugs; small or odd holds stop them.',
    'Holds jugs and big edges; anything else feels insecure.',
    'Fine on edges and jugs; slopers, pinches or pockets often stop them.',
    'Fine on edges and jugs; starting to use slopers and pinches on easy climbs.',
    'Uses every common hold type at their level; a few are clearly weaker.',
    'Uses every common hold type at their level; one is clearly weaker.',
    'Strong on most hold types near their limit.',
    'Strong on most hold types at their limit; knows how to grip each one.',
    'Almost any hold works for them; a weakness only shows at their limit.',
    'Any hold type works for them; no clear weakness.']),
  ('wall angles', array[
    'Comfortable on one angle only; struggles on the others even when easy.',
    'Climbs a second angle at easy grades.',
    'Climbs most angles at easy grades; their grade drops a lot off their favorite angle.',
    'Climbs most angles; their grade drops a couple of grades off their favorite.',
    'Climbs slab, vertical and overhang at their level; one or two angles lag.',
    'Climbs slab, vertical and overhang at their level; one angle or roofs still lag.',
    'Within about two grades on every angle.',
    'Within about a grade on every angle, roofs included.',
    'Climbs near their hardest grade on any angle.',
    'Climbs their hardest grade on any angle, slab to roof.']),
  ('projecting', array[
    'Gives up on a climb after a few tries; doesn''t break it into parts.',
    'Tries a hard climb for a session, but goes top to bottom every go.',
    'Works a project for a session or two, but tries the whole thing every go.',
    'Works projects for a few sessions; starting to try moves on their own.',
    'Breaks problems into sections and rests between goes.',
    'Breaks problems into sections, rests between goes and remembers what works.',
    'Sticks with projects for weeks; sometimes changes beta when stuck.',
    'Sticks with projects over weeks; changes beta and tactics when stuck.',
    'Picks projects that fit their goals; patient over weeks.',
    'Picks projects that fit their goals; patient and strategic, sends hard climbs over time.'])
) as g(key, lines)
where a.name_key = g.key and cardinality(a.guide) <> 10;
update public.team_rating_areas set guide = '{}' where cardinality(guide) not in (0, 10);   -- any other area's old 5 lines
alter table public.team_rating_areas add constraint team_rating_areas_guide_check check (cardinality(guide) in (0, 10));

commit;
