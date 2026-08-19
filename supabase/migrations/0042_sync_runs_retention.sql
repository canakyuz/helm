-- sync_runs retention — tablo sinirsiz buyuyordu.
--
-- NEDEN GEREKLI: helm-ingest saat basi, helm-reviews yarim saatte bir calisiyor
-- ve her calisma bir satir yaziyor. Hicbir yerde temizlik yoktu: gunde ~24+
-- satir, sonsuza kadar. Panel de bu tablodan yalnizca EN SON satiri gosteriyor,
-- yani eski kayitlarin okuma degeri gunler icinde sifira dusuyor ama maliyeti
-- kalmaya devam ediyor.
--
-- NEDEN 30 GUN: "senkron ne zaman bozuldu" sorusu pratikte son birkac gune
-- bakiyor; 30 gun rahat bir pay biraktigi halde tabloyu ~750 satirda sabitliyor.

create or replace function public.helm_prune_sync_runs(keep_days int default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.sync_runs
  where started_at < now() - make_interval(days => keep_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.helm_prune_sync_runs(int) is
  'sync_runs kayitlarini keep_days gunden eskiyse siler; silinen satir sayisini doner.';

-- Gece 03:15 UTC — saat basi ingest ve yarim saatlik reviews cakismasin.
select cron.schedule(
  'helm-prune-sync-runs',
  '15 3 * * *',
  $job$ select public.helm_prune_sync_runs(30); $job$
);

-- Job'u kaldirmak icin:  select cron.unschedule('helm-prune-sync-runs');
