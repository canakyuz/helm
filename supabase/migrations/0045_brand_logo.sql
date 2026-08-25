-- Marka basina logo - sidebar kapsam secicisi sabit "H" karesi yerine
-- aktif markanin logosunu gostersin.
--
-- Depolama karari: YENI BUCKET ACILMADI. 0017'deki `cms-assets` bucket'i zaten
-- `public = true` (anon select) + authenticated insert/update/delete politikalari
-- tasiyor ve politikalar path'e degil sadece `bucket_id`'ye bakiyor. Yani CMS'e
-- ozel olan tek sey ISIM; erisim modeli marka logosu icin de birebir dogru.
-- Logolar `brand-logos/<brandId>-<uuid>.<ext>` prefix'i altinda duruyor ve
-- `public.cms_assets` tablosuna KAYIT DUSMUYOR - bu yuzden CMS medya
-- kutuphanesinde gorunmuyorlar, sadece storage'da yer kapliyorlar.
--
-- Geri uyumlu: kolon nullable, default yok, backfill yok. Logosu olmayan marka
-- eskisi gibi harf/ikon fallback'i ile cizilir.

alter table public.brands
  add column if not exists logo_url text;

comment on column public.brands.logo_url is
  'cms-assets bucket''indaki brand-logos/ prefixli dosyanin public URL''i. Null = logo yok.';
