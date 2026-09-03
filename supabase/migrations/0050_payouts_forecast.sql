-- ─────────────────────────────────────────────────────────────
-- payouts: tahmin (forecast) + elle giris destegi.
--
-- NEDEN: 0031'deki model Stripe seklinde kurulmustu - status enum'u
-- (pending|in_transit|paid|failed|canceled) ve tek bir arrival_date.
-- Apple ve reklam aglari boyle davranmiyor:
--   • Apple/AdSense esik altinda kalan bakiyeyi ODEMEZ, sonraki aya DEVREDER.
--     Bu "pending" degil - para hak edilmis ama takvimde yok. Ayri bir durum.
--   • Apple mali (fiscal) donem kapanmadan tutari kesinlestirmez.
--   • Odeme tarihi tek gun degil, ARALIKTIR ("3-7 Eylul"). Tek tarih yazmak
--     sahte kesinlik uretir - kokpitte en pahali hata turu.
--   • Apple hesap duzeyinde oder, uygulama duzeyinde degil → project_id null
--     olabilmeli (zaten nullable, burada anlamlandiriliyor).
--
-- PARA BIRIMI KURALI (degismiyor, altini ciziyoruz): cevrilmis tutar ASLA
-- saklanmaz. amount + currency kaynak para biriminde durur; GBP/USD gosterimi
-- okuma aninda canli kurla hesaplanir (packages/api/src/fx-rates.ts).
-- Sabitlenmis bir kur alani (ornegin estimated_gbp) bu tabloya eklenmemeli:
-- 2026-08-24'te yasanan sessiz kur hatasinin aynisini geri getirir.
-- ─────────────────────────────────────────────────────────────

alter table public.payouts
  -- Kazancin ait oldugu donem (YYYY-MM). arrival'dan AYRIDIR: Haziran kazanci
  -- Eylul'de odenebilir. Onceden hicbir yerde tutulmuyordu.
  add column if not exists period       text,
  -- Odeme penceresinin BITISI. arrival_date artik pencerenin BASI olarak
  -- okunur; null birakilirsa satir tek gunluk (eski davranis birebir korunur).
  add column if not exists arrival_end  date,
  -- Satirin gelis yolu. 'sync' = konnektor yazdi (helm-payouts upsert eder,
  -- ustune yazabilir). 'manual' = elle girilmis tahmin; senkron ASLA ezmez.
  add column if not exists entry_source text not null default 'sync',
  add column if not exists note         text;

-- period bicimi (null serbest - eski satirlarda yok).
alter table public.payouts drop constraint if exists payouts_period_fmt;
alter table public.payouts add constraint payouts_period_fmt
  check (period is null or period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Pencere tutarli olmali.
alter table public.payouts drop constraint if exists payouts_window_order;
alter table public.payouts add constraint payouts_window_order
  check (arrival_end is null or arrival_date is null or arrival_end >= arrival_date);

alter table public.payouts drop constraint if exists payouts_entry_source_chk;
alter table public.payouts add constraint payouts_entry_source_chk
  check (entry_source in ('sync', 'manual'));

-- Durum sozlugu: Stripe'in bes durumu + magaza/reklam agi yasam dongusu.
-- NOT VALID: canli tabloda beklenmedik bir Stripe durumu varsa migration'i
-- dusurmesin; kural YENI satirlara bugunden itibaren uygulanir. Mevcut veri
-- temizlendiginde `validate constraint` ile tamamlanir.
alter table public.payouts drop constraint if exists payouts_status_chk;
alter table public.payouts add constraint payouts_status_chk
  check (status in (
    'carried_forward',      -- esik altinda kaldi, bakiye sonraki doneme devretti
    'pending_fiscal_close', -- mali donem kapanmadi, tutar kesinlesmedi
    'threshold_reached',    -- esik asildi, odeme sirasina girdi
    'pending',
    'in_transit',
    'paid',
    'failed',
    'canceled'
  )) not valid;

-- Elle girilen satirlar az sayida ve her okumada taranir → partial index.
create index if not exists payouts_manual_idx
  on public.payouts (arrival_date)
  where entry_source = 'manual';

comment on column public.payouts.period       is 'Kazancin ait oldugu donem (YYYY-MM); odeme tarihinden ayridir.';
comment on column public.payouts.arrival_end  is 'Odeme penceresinin bitisi; null ise arrival_date tek gundur.';
comment on column public.payouts.entry_source is 'sync = konnektor yazdi (ustune yazilabilir), manual = elle girilmis tahmin (senkron ezmez).';
comment on column public.payouts.amount       is 'KAYNAK para biriminde. Cevrilmis tutar saklanmaz - okuma aninda canli kurla hesaplanir.';
