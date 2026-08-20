-- WES-000 metrics.currency - kaynak para birimi etiketi.
-- Revenue değerleri KAYNAK para biriminde saklanır (AdMob ad_revenue → TRY,
-- RevenueCat mrr → USD, App Store proceeds → vendor ccy). Bu kolon her satırı
-- kaynağının currency'siyle etiketler; değer HAM kalır (çeviri gösterimde,
-- @helm/api metricValueUsd ile USD'ye normalize edilerek yapılır).
--
-- ÖNEMLİ: Bu migration'dan ÖNCE entegrasyon sayfasında AdMob (ve gerekiyorsa
-- App Store) "Para birimi" alanını doğru ayarla (AdMob = TRY). Backfill mevcut
-- satırları o config'e göre etiketler.

alter table public.metrics add column if not exists currency text;

-- Backfill: mevcut satırları kaynak entegrasyonun config currency'siyle etiketle.
-- metrics.source = project_integrations.provider (admob, revenuecat, app_store_connect…).
update public.metrics m
set currency = coalesce(nullif(pi.config->>'currency', ''), 'USD')
from public.project_integrations pi
where pi.project_id = m.project_id
  and pi.provider = m.source
  and m.currency is null;

-- Eşleşmeyen kalan satırlar (entegrasyon silinmiş / source farklı) USD varsay.
update public.metrics set currency = 'USD' where currency is null;

-- Yeni satırlar ingest'te etiketlenir; emniyet için DB default da USD.
alter table public.metrics alter column currency set default 'USD';
