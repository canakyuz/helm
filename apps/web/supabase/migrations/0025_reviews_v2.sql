-- helm — reviews v2: yeni kaynak (Google Play), version + territory + yanıt alanları.
-- ASC Customer Reviews API'ye geçiş için source_method ayrımı.

alter table public.reviews
  add column if not exists territory          text,
  add column if not exists app_version        text,
  add column if not exists developer_response text,
  add column if not exists responded_at       timestamptz,
  add column if not exists source_method      text;

-- Mevcut row'lar RSS kaynaklı — backfill
update public.reviews
  set source_method = 'rss'
  where source_method is null and source = 'appstore';

comment on column public.reviews.source is
  '''appstore'' (iOS) veya ''playstore'' (Android)';
comment on column public.reviews.source_method is
  '''asc'' (App Store Connect API) | ''rss'' (iTunes RSS) | ''play'' (Google Play API)';
comment on column public.reviews.territory is
  'iOS: ISO 3166-1 alpha-2 country (us, tr); Android: language code (en, tr)';
