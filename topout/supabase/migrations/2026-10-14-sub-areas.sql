-- Sub-areas (the user asked: more detail, like Footwork → Heel Hooks, Smearing, …). A focus area can have sub-areas
-- (parent_id), one level only. A sub-area takes its area's group and Rated, and is rated and tagged like any area:
-- check-ins keep {area id: 1..5}, so a sub-area's rating sits beside the others. The app works out an area's score on a
-- check-in as the average of its rated sub-areas, else its own rating. Deleting an area deletes its sub-areas (and
-- team_area_cleanup takes each one's ratings and tags off).
begin;

alter table public.team_rating_areas add column parent_id uuid references public.team_rating_areas (id) on delete cascade;
create index team_rating_areas_parent on public.team_rating_areas (parent_id);

create function public.team_area_parent() returns trigger
language plpgsql set search_path = '' as $$
declare
  p public.team_rating_areas;
begin
  if new.parent_id is not null then
    select * into p from public.team_rating_areas where id = new.parent_id;
    if p.parent_id is not null then raise exception 'A sub-area can''t have sub-areas of its own.'; end if;
    if exists (select 1 from public.team_rating_areas where parent_id = new.id) then
      raise exception 'An area with sub-areas can''t become a sub-area.';
    end if;
    new.area_group := p.area_group;
    new.rated := p.rated;
  end if;
  return new;
end;
$$;
create trigger team_area_parent before insert or update on public.team_rating_areas
  for each row execute function public.team_area_parent();

-- Changing an area's group or Rated changes its sub-areas too.
create function public.team_area_children() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.team_rating_areas set area_group = new.area_group, rated = new.rated
  where parent_id = new.id and (area_group, rated) is distinct from (new.area_group, new.rated);
  return null;
end;
$$;
create trigger team_area_children after update of area_group, rated on public.team_rating_areas
  for each row execute function public.team_area_children();

commit;
