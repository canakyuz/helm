-- Oyun telemetrisi hunileri - tek RPC, sunucu tarafi toplama.
--
-- NEDEN RPC: game_events 26k+ satir ve buyuyor. Ham satirlari istemciye cekip
-- mobilde gruplamak hem ag hem bellek israfi olurdu. PostgREST tek basina
-- GROUP BY yapamadigi icin toplama buraya iniyor.
--
-- NEDEN TEK JSONB: alti ayri sorgu alti gidis-donus demek; ekran acilisi
-- bunlarin toplamini bekler. Tek cagri, tek bekleme.
--
-- security invoker: mevcut RLS politikasi ("authenticated read game_events")
-- gecerli kalir. Fonksiyon yetki yukseltmez.

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
  select *
  from game_events
  where occurred_at >= now() - make_interval(days => p_days)
    and (p_project_id is null or project_id = p_project_id)
),

-- Oturum: baslayan / biten. Fark "kapanmayan" demek - cokme veya surec olumu.
sessions as (
  select
    coalesce(platform, 'bilinmiyor') platform,
    count(*) filter (where event_key = 'start') started,
    count(*) filter (where event_key = 'end') ended
  from scoped
  where event_type = 'session'
  group by 1
),

-- Reklam: gosterim olaylari ve hata olaylari BICIM bazinda eslestirilir.
-- Hata anahtari 'ad_<bicim>_fail' seklinde; ortadaki bicim cikarilir.
ad_shown as (
  select event_key fmt, count(*) n
  from scoped where event_type = 'ad' group by 1
),
ad_failed as (
  select
    regexp_replace(event_key, '^ad_(.*)_fail$', '\1') fmt,
    count(*) n
  from scoped
  where event_type = 'error' and event_key like 'ad\_%\_fail'
  group by 1
),
ads as (
  select
    coalesce(s.fmt, f.fmt) fmt,
    coalesce(s.n, 0) shown,
    coalesce(f.n, 0) failed
  from ad_shown s
  full outer join ad_failed f on f.fmt = s.fmt
),

-- Oyun akisi: metric anahtarlari. Sira UI'da belirlenir, burada ham sayim.
game as (
  select event_key, count(*) n
  from scoped
  where event_type = 'metric'
    and event_key not in ('fps_min', 'fps_p95_low')
  group by 1
),

purchases as (
  select event_key, count(*) n
  from scoped where event_type = 'purchase' group by 1
),

-- Platform kirilimi: sorunun her yerde mi tek platformda mi oldugunu soyler.
platforms as (
  select coalesce(platform, 'bilinmiyor') platform, count(*) n
  from scoped group by 1
),

-- Performans: fps dagilimi. Ortalama yaniltir (birkac cok dusuk deger
-- ortalamayi bozar), bu yuzden yuzdelik dilim.
perf as (
  select
    event_key,
    count(*) samples,
    round(percentile_cont(0.50) within group (order by value)::numeric, 1) p50,
    round(percentile_cont(0.05) within group (order by value)::numeric, 1) p05,
    round(min(value)::numeric, 1) worst
  from scoped
  where event_type = 'metric'
    and event_key in ('fps_min', 'fps_p95_low')
    and value is not null
  group by 1
),

-- Hatalar: reklam disi olanlar da var; Saglik ekrani icin.
errors as (
  select event_key, count(*) n
  from scoped where event_type = 'error' group by 1
)

select jsonb_build_object(
  'days', p_days,
  'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'platform', platform, 'started', started, 'ended', ended)
      order by started desc) from sessions where started > 0 or ended > 0), '[]'::jsonb),
  'ads', coalesce((select jsonb_agg(jsonb_build_object(
      'format', fmt, 'shown', shown, 'failed', failed)
      order by (shown + failed) desc) from ads), '[]'::jsonb),
  'game', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'count', n) order by n desc) from game), '[]'::jsonb),
  'purchases', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'count', n) order by n desc) from purchases), '[]'::jsonb),
  'platforms', coalesce((select jsonb_agg(jsonb_build_object(
      'platform', platform, 'events', n) order by n desc) from platforms), '[]'::jsonb),
  'perf', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'samples', samples, 'p50', p50, 'p05', p05, 'worst', worst)
      ) from perf), '[]'::jsonb),
  'errors', coalesce((select jsonb_agg(jsonb_build_object(
      'key', event_key, 'count', n) order by n desc) from errors), '[]'::jsonb)
);
$$;

comment on function public.game_funnels is
  'Oyun telemetrisi hunileri: oturum, reklam, oyun akisi, satin alma, platform, fps, hatalar. Tek cagri.';

grant execute on function public.game_funnels(uuid, int) to authenticated, anon;
