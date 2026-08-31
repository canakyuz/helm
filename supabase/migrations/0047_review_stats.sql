-- 0047 - yorum istatistikleri: 1000 satir tavanini agregasyonla asar.
--
-- OLCUM (2026-08-31, Supabase Management API / PostgREST config):
--   max_rows = 1000
--
-- Reviews sayfasi listeyi pagination:"off" ile cekiyordu; ortalama, yildiz
-- dagilimi, iOS/Android ortalamalari ve negatif sayaci o pencereden
-- hesaplaniyordu. Tavan asildiginda sayfa BOS gostermez, YANLIS sayi
-- gosterir - sessiz bozulma. Mobil tarafta ayni hata 200'luk pencereyle
-- vardi (packages/api fetchReviews limit(200)).
--
-- Bu fonksiyon source x rating pivotunu DB'de toplar: en fazla 12 satir
-- doner (2 kaynak x [1..5 + puansiz]). Istatistik boylece veri hacminden
-- bagimsiz olarak dogru gelir; liste tarafi ayrica server-side sayfalanir.
-- 0044'teki metrik toplamasiyla ayni desen.

create or replace function public.helm_review_stats(
  p_project_id uuid default null
)
returns table (
  source text,
  rating smallint,
  cnt    bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.source,
    r.rating::smallint,
    count(*)::bigint
  from public.reviews r
  where p_project_id is null or r.project_id = p_project_id
  group by r.source, r.rating;
$$;

comment on function public.helm_review_stats(uuid) is
  'Yorum istatistigi icin source x rating sayimlari (max 12 satir). Ortalama/dagilim listeden DEGIL buradan hesaplanir - liste PostgREST 1000 tavaninda kesilir.';

grant execute on function public.helm_review_stats(uuid) to authenticated;
