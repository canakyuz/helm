-- Oyun akisini PROJE BASINA dondur.
--
-- NEDEN: "tum projeler" seciliyken akis hunisini toplamak anlamsiz veri uretir —
-- Block Forge'un "oyun bitti"si ile Echo'nun "seviye tamamlandi"si ayni kutuya
-- girer. Her oyunun kendi sozlugu var. UI proje basina ayri kart gosterir.
--
-- NEDEN RPC ICINDE: alternatif her proje icin ayri cagri, yani N+1. Tek sorguda
-- gruplamak hem tek gidis-donus hem de indeksten faydalanir.

create or replace function public.game_funnels(
  p_project_id uuid default null,
  p_days int default 30
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with scoped as (
  select g.*, pr.name project_name
  from game_events g
  join properties pr on pr.id = g.project_id
  where g.occurred_at >= now() - make_interval(days => p_days)
    and (p_project_id is null or g.project_id = p_project_id)
),
sessions as (
  select coalesce(platform, 'bilinmiyor') platform,
         count(*) filter (where event_key = 'start') started,
         count(*) filter (where event_key = 'end') ended
  from scoped where event_type = 'session' group by 1
),
ad_shown as (
  select event_key fmt, count(*) n from scoped where event_type = 'ad' group by 1
),
ad_failed as (
  select regexp_replace(event_key, '^ad_(.*)_fail$', '\1') fmt, count(*) n
  from scoped where event_type = 'error' and event_key like 'ad\_%\_fail' group by 1
),
ads as (
  select coalesce(s.fmt, f.fmt) fmt, coalesce(s.n, 0) shown, coalesce(f.n, 0) failed
  from ad_shown s full outer join ad_failed f on f.fmt = s.fmt
),
game as (
  select event_key, count(*) n from scoped
  where event_type = 'metric' and event_key not in ('fps_min', 'fps_p95_low')
  group by 1
),
-- Proje basina akis: her oyunun kendi sozlugu ayri kalir.
game_by_project as (
  select project_id, project_name, event_key, count(*) n
  from scoped
  where event_type = 'metric' and event_key not in ('fps_min', 'fps_p95_low')
  group by 1, 2, 3
),
game_projects as (
  select project_id, project_name,
         jsonb_agg(jsonb_build_object('key', event_key, 'count', n) order by n desc) steps,
         sum(n) total
  from game_by_project group by 1, 2
),
purchases as (
  select event_key, count(*) n from scoped where event_type = 'purchase' group by 1
),
platforms as (
  select coalesce(platform, 'bilinmiyor') platform, count(*) n from scoped group by 1
),
perf as (
  select event_key, count(*) samples,
         round(percentile_cont(0.50) within group (order by value)::numeric, 1) p50,
         round(percentile_cont(0.05) within group (order by value)::numeric, 1) p05,
         round(min(value)::numeric, 1) worst
  from scoped
  where event_type = 'metric' and event_key in ('fps_min', 'fps_p95_low') and value is not null
  group by 1
),
errors as (
  select event_key, count(*) n from scoped where event_type = 'error' group by 1
)
select jsonb_build_object(
  'days', p_days,
  'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'platform', platform, 'started', started, 'ended', ended) order by started desc)
      from sessions where started > 0 or ended > 0), '[]'::jsonb),
  'ads', coalesce((select jsonb_agg(jsonb_build_object(
      'format', fmt, 'shown', shown, 'failed', failed) order by (shown + failed) desc)
      from ads), '[]'::jsonb),
  'game', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'count', n) order by n desc) from game), '[]'::jsonb),
  'gameByProject', coalesce((select jsonb_agg(jsonb_build_object(
      'projectId', project_id, 'projectName', project_name, 'steps', steps)
      order by total desc) from game_projects), '[]'::jsonb),
  'purchases', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'count', n) order by n desc) from purchases), '[]'::jsonb),
  'platforms', coalesce((select jsonb_agg(jsonb_build_object(
      'platform', platform, 'events', n) order by n desc) from platforms), '[]'::jsonb),
  'perf', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'samples', samples, 'p50', p50, 'p05', p05, 'worst', worst))
      from perf), '[]'::jsonb),
  'errors', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'count', n) order by n desc) from errors), '[]'::jsonb)
);
$$;

grant execute on function public.game_funnels(uuid, int) to authenticated, anon;
