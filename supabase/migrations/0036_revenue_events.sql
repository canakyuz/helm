-- Gercek zamanli gelir olaylari — RevenueCat webhook'u.
--
-- NEDEN GEREKLI: subscription_revenue / iap_revenue metrikleri App Store
-- Connect'ten geliyor ve Apple gunluk satis raporlarini T-1 yayinliyor, ustune
-- kendi isleme gecikmesi var. Bir satin alma panelde 1-2 gun sonra goruluyor.
-- RevenueCat ise olayi aninda biliyor; webhook o bosluğu kapatir.
--
-- Bu tablo metrics'in YERINE gecmez, ONUNLE YASAR: metrics gunluk mutabakatli
-- toplamdir (Apple'in resmi rakami), bu tablo "az once ne oldu"dur.

create table if not exists public.revenue_events (
  id bigint generated always as identity primary key,
  project_id uuid references public.properties(id) on delete cascade,
  -- RevenueCat olay kimligi — ayni olay iki kez POST edilirse ikinci yazilmaz.
  event_id text not null unique,
  -- INITIAL_PURCHASE, RENEWAL, CANCELLATION, NON_RENEWING_PURCHASE...
  event_type text not null,
  store text,
  product_id text,
  -- RC "app_user_id" — kisisel veri sayilabilir, ham saklanir ama UI'da
  -- kirpilarak gosterilir (panelde de 3947••••5300 seklinde).
  app_user_id text,
  country_code text,
  -- RC tutari mikro-birimde verir; burada normal para birimine cevrilmis halde.
  amount numeric,
  currency text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  raw jsonb
);

-- Ekranlar "son islemler"i ister: proje + zaman, azalan.
create index if not exists idx_revenue_events_project_time
  on public.revenue_events (project_id, occurred_at desc);

alter table public.revenue_events enable row level security;

create policy "authenticated read revenue_events" on public.revenue_events
  for select to authenticated using (true);

-- Yazma YALNIZCA service role uzerinden (edge function). Anon/authenticated
-- yazamaz; webhook disindan kayit uretilmesini engeller.

comment on table public.revenue_events is
  'RevenueCat webhook olaylari — gercek zamanli satin alma akisi. Gunluk mutabakat metrics tablosunda kalir.';
