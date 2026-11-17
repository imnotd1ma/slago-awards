-- Keep the current database nominee list visible until a curated list is provided.
update public.slago_nominees nominee
set is_legend_year_selected = true
from public.slago_nominations nomination
where nominee.nomination_id = nomination.id
  and nomination.slug = 'legend-year';
