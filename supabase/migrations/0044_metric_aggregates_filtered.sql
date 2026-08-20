-- 0043'un eksigini kapatir: METRIK FILTRESI.
--
-- OLCUM (2026-08-20, gercek veri, 90 gunluk pencere):
--   filtresiz + toplamasiz : 3.102 satir  → PostgREST 1000 tavaninda KESILIYOR
--   sadece toplama         : 2.414 satir  → hala tavanin ustunde, sorun surer
--   metrik filtresi + toplama:  345 satir → 9x kucuk, tavanin ALTINDA
--
-- Tabloda 30 farkli metrik var; dashboard bunlardan 4'unu kullaniyor
-- (ad_revenue, mrr, dau, errors) ve kalan 26'sini indirip atiyordu. Asil
-- israf toplama eksikligi degil, GEREKSIZ VERI ISTEMEKTI. 0043 yalniz
-- toplama yaptigi icin tek basina yetmiyordu.
--
-- p_metrics null gecilirse tum metrikler doner — cagri yerinin acikca
-- istemesi beklenir, varsayilan "hepsi" olmasi bu hatanin kaynagiydi.

drop function if exists public.helm_metric_daily(date, uuid);

create or replace function public.helm_metric_daily(
  p_since      date,
  p_metrics    text[] default null,
  p_project_id uuid   default null
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
    m.date                      as day,
    m.metric,
    coalesce(m.currency, 'USD') as currency,
    sum(m.value)                as value
  from public.metrics m
  where m.date >= p_since
    and (p_metrics    is null or m.metric     = any(p_metrics))
    and (p_project_id is null or m.project_id = p_project_id)
  group by m.date, m.metric, coalesce(m.currency, 'USD')
  order by m.date;
$$;

comment on function public.helm_metric_daily(date, text[], uuid) is
  'Gunluk metrik toplamlari. p_metrics ile SADECE gereken metrikleri iste — filtresiz cagri 1000 satir tavanina carpar.';

grant execute on function public.helm_metric_daily(date, text[], uuid) to authenticated;
