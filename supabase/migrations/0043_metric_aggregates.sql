-- Panel toplamalarini VERITABANINDA yap — ham satir tarayiciya inmesin.
--
-- SORUN: dashboard `metrics` tablosunu `date >= 90 gun` filtresiyle, SIRALAMASIZ
-- ve LIMITSIZ cekiyordu. Refine'in `pagination: { mode: "off" }` ayari `.range()`
-- gondermedigi icin PostgREST kendi max-rows tavanini uyguluyor. Satir sayisi
-- tavani asinca:
--   · gelen 1000 satir ARBITRARY (order by yok) — hangi gunler geldigi belirsiz,
--   · en guncel gunler disarida kalabiliyor → aylik gelir / anlik reklam geliri
--     ekranda hic gorunmuyor.
-- Yani sorun yavaslik degil, SESSIZ VERI KAYBI. Limit koymak yetmez; toplama
-- zaten istemcide yapiliyordu, oraya ham satir gondermenin bir sebebi yok.
--
-- COZUM: (project, source) kirilimini SQL'de topla. 4 proje x 7 kaynak carpani
-- kayboluyor: ~3600 satir → ~600 satir, ustelik siralanmis ve TAM.
--
-- security invoker BILEREK: RLS uygulanmaya devam etsin. Panel `authenticated`
-- ve metrics politikasi zaten "authenticated full access"; definer yapmak
-- gereksizce yetki genisletirdi.

create or replace function public.helm_metric_daily(
  p_since      date,
  p_project_id uuid default null
)
returns table (
  day      date,
  metric   text,
  currency text,
  value    numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.date                          as day,
    m.metric,
    coalesce(m.currency, 'USD')     as currency,
    sum(m.value)                    as value
  from public.metrics m
  where m.date >= p_since
    and (p_project_id is null or m.project_id = p_project_id)
  group by m.date, m.metric, coalesce(m.currency, 'USD')
  order by m.date;
$$;

comment on function public.helm_metric_daily(date, uuid) is
  'Gunluk metrik toplamlari (proje/kaynak kirilimi toplanmis). Panel serileri icin.';

-- Proje kirilimi YALNIZCA son gun icin gerekiyor (dashboard "proje basina
-- reklam geliri / MRR" kartlari). Tum gunleri proje bazinda dondurmek satir
-- sayisini tekrar carpardi; `distinct on` ile her proje+metrik icin tek satir.
create or replace function public.helm_metric_latest_by_project(
  p_metrics text[],
  p_since   date
)
returns table (
  project_id uuid,
  metric     text,
  day        date,
  currency   text,
  value      numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (t.project_id, t.metric)
    t.project_id, t.metric, t.day, t.currency, t.value
  from (
    select
      m.project_id,
      m.metric,
      m.date                      as day,
      coalesce(m.currency, 'USD') as currency,
      sum(m.value)                as value
    from public.metrics m
    where m.date >= p_since
      and m.metric = any(p_metrics)
    group by m.project_id, m.metric, m.date, coalesce(m.currency, 'USD')
  ) t
  order by t.project_id, t.metric, t.day desc;
$$;

comment on function public.helm_metric_latest_by_project(text[], date) is
  'Her proje+metrik icin EN SON gunun toplami. Proje kirilimli kartlar icin.';

grant execute on function public.helm_metric_daily(date, uuid) to authenticated;
grant execute on function public.helm_metric_latest_by_project(text[], date) to authenticated;
