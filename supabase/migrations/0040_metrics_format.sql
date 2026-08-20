-- metrics_format — gunluk metrik kirilimi (reklam formati bazli).
--
-- NEDEN GEREKLI: gelirin buyuk kismi reklamdan geliyor ama panelde tek satir
-- ("Reklam ₺340.71") olarak duruyordu; hangi formatin kazandirdigi, hangisinin
-- bosa gosterim yaktigi gorunmuyordu. Olculdu (6-13 Agustos):
--
--   rewarded      gosterimlerin %15'i  →  gelirin %77'si   eCPM ₺482
--   banner        gosterimlerin %77'si →  gelirin %11'i    eCPM  ₺13, doluluk %56
--
-- Bu ayrim olmadan "reklam geliri artti/azaldi" disinda bir sey soylenemiyor.
--
-- metrics_country ile AYNI DESEN: ana metrics tablosunu kirletmemek icin ayri
-- tablo, PK'de kirilim boyutu, idempotent upsert.
--
-- currency SUTUNU VAR (metrics_country'de yok): burada para tasiniyor.
-- AdMob hesabin para biriminde raporluyor (bizde TRY); currency olmadan
-- ad_revenue sayilari birimsiz kalir ve baska bir kaynakla toplanamaz.

create table if not exists public.metrics_format (
  project_id    uuid not null references public.properties(id) on delete cascade,
  date          date not null,
  source        text not null,
  metric        text not null,
  -- AdMob FORMAT boyutu: app_open, banner, interstitial, rewarded
  -- (dogrulandi: networkReport FORMAT degerleri kucuk harf donuyor).
  -- Serbest metin — AdMob yeni bir format eklerse migration gerekmesin.
  format        text not null,
  value         numeric not null default 0,
  currency      text,
  ingested_at   timestamptz not null default now(),
  primary key (project_id, date, source, metric, format)
);

create index if not exists metrics_format_project_date_idx
  on public.metrics_format (project_id, date desc);

create index if not exists metrics_format_metric_idx
  on public.metrics_format (metric, date desc);

alter table public.metrics_format enable row level security;

drop policy if exists "authenticated full access" on public.metrics_format;
create policy "authenticated full access" on public.metrics_format
  for all to authenticated using (true) with check (true);

comment on table public.metrics_format is
  'Reklam formati kirilimli gunluk metrikler. ORAN YAZILMAZ (eCPM, doluluk): oranlar toplanamaz, gelir/gosterim/istek/eslesen sayimlarindan turetilir.';
