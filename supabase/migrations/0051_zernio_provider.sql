-- Zernio sosyal medya saglayicisi - hesaplar + hesap x gun metrikleri.
--
-- NEDEN AYRI TABLO: takipci/impression/engagement toplamlari `metrics`'e gider
-- (KPI, uyari, kapsam ayni yoldan calissin diye). Ama "hangi hesap, hangi
-- platform, kac takipci" bilgisi metrics'in (project, date, source, metric)
-- anahtarina sigmaz. Hesap listesi kucuk ve gecikmesiz; hesap x gun kirilimi
-- platform grafigi icin. Gelen webhook olaylari da projeye buradaki
-- account_id -> project_id koprusuyle baglanir (RevenueCat'teki "tek
-- entegrasyonu sec" kisayolu yerine).

alter table public.project_integrations
  drop constraint if exists project_integrations_provider_check;

alter table public.project_integrations
  add constraint project_integrations_provider_check
  check (
    provider in (
      'revenuecat', 'admob', 'posthog', 'supabase',
      'stripe', 'plausible', 'rest', 'sentry',
      'app_store_connect', 'resend', 'google_play_developer',
      'zernio'
    )
  );

create table if not exists public.social_accounts (
  -- Zernio account _id (24 hex). Upsert anahtari; ayni hesap iki kez yazilmaz.
  id text primary key,
  project_id uuid not null references public.properties(id) on delete cascade,
  platform text not null,
  username text,
  display_name text,
  avatar_url text,
  profile_url text,
  -- Zernio yalnizca analytics eklentisiyle verir; yoksa null (0 degil).
  followers_count integer,
  is_active boolean not null default true,
  -- Platform token'i oldu; kullanici Zernio'da yeniden baglamali.
  needs_reconnection boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_social_accounts_project
  on public.social_accounts (project_id);

alter table public.social_accounts enable row level security;

drop policy if exists "authenticated read social_accounts" on public.social_accounts;
create policy "authenticated read social_accounts" on public.social_accounts
  for select to authenticated using (true);

-- Yazma YALNIZCA service role (helm-ingest, helm-social, helm-zernio-webhook).

create table if not exists public.social_account_daily (
  account_id text not null references public.social_accounts(id) on delete cascade,
  date date not null,
  -- Gunun sonundaki anlik takipci sayisi; o gun olculmediyse null.
  followers integer,
  impressions integer not null default 0,
  reach integer not null default 0,
  -- likes + comments + shares + saves
  engagements integer not null default 0,
  primary key (account_id, date)
);

alter table public.social_account_daily enable row level security;

drop policy if exists "authenticated read social_account_daily" on public.social_account_daily;
create policy "authenticated read social_account_daily" on public.social_account_daily
  for select to authenticated using (true);

comment on table public.social_accounts is
  'Zernio uzerinden bagli sosyal hesaplar - proje koprusu ve anlik takipci sayisi.';
comment on table public.social_account_daily is
  'Hesap x gun sosyal metrikleri. Toplamlar metrics tablosunda (source=zernio).';
