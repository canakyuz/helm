-- Gelir olaylarina ORTAK DOGAL ANAHTAR - cift sayimi yapisal olarak engeller.
--
-- SORUN: ayni para iki yoldan geliyor.
--   1. helm-revenuecat-webhook  → RC olay kimligiyle (event_id)
--   2. scripts/backfill-revenuecat.sh → RC REST API'sinden, olay kimligi YOK
-- Webhook kesintiye ugrayip geri doldurma calistirilirsa (tam olarak bugun olan
-- sey: webhook yanlis Supabase projesine bakiyordu, iki odeme kayboldu) ayni
-- odeme iki farkli kimlikle iki satir olur. Gelir kokpitinde iki kez sayilan
-- para, hic gosterilmeyen paradan daha kotudur - yanlis rakama guvenirsiniz.
--
-- COZUM: parayi kimlikleyen sey RC'nin olay kimligi degil, MAGAZANIN islem
-- kimligi + odeme aninin kendisidir. Iki taraf da onu hesaplayabiliyor:
--
--   webhook       original_transaction_id + purchased_at_ms
--   REST purchase store_purchase_identifier + purchased_at
--   REST abonelik store_subscription_identifier + current_period_starts_at
--
-- Yenilemede Apple yeni bir transaction_id uretir ama original_transaction_id
-- ayni kalir; donem baslangici degistigi icin anahtar yine de ayrisir. Bu yuzden
-- anahtarda transaction_id DEGIL original kullaniliyor.
--
-- GELIR URETMEYEN OLAYLAR (CANCELLATION, BILLING_ISSUE...) ayni islemi isaret
-- eder; parayla ayrisamazlar. Onlar 'evt:<event_id>' ile anahtarlanir - boylece
-- iptal sinyali satin almanin kopyasi sanilip yutulmaz.

alter table public.revenue_events add column if not exists txn_key text;

-- Tablo su an bos (webhook yanlis projeye bakiyordu, hic satir yazilmadi), bu
-- yuzden geri doldurma adimi gerekmiyor ve NOT NULL dogrudan konabiliyor.
update public.revenue_events set txn_key = 'evt:' || event_id where txn_key is null;
alter table public.revenue_events alter column txn_key set not null;

create unique index if not exists uq_revenue_events_txn_key
  on public.revenue_events (txn_key);

-- event_id artik tekil DEGIL: geri doldurmadan gelen satirin RC olay kimligi
-- yoktur. Bilgi amacli kalir, tekillik txn_key'e tasindi.
alter table public.revenue_events drop constraint if exists revenue_events_event_id_key;
alter table public.revenue_events alter column event_id drop not null;

comment on column public.revenue_events.txn_key is
  'Odemenin dogal anahtari: <store>:<original_txn_id>:<purchased_at_ms>. Gelir uretmeyen olaylarda evt:<event_id>. Webhook ve geri doldurma ayni anahtari uretir - cift sayim olmaz.';
