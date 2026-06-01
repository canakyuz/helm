-- helm hub şeması — çok-projeli founder cockpit
-- Tüm projelerin (mobil uygulama / web / SaaS) gelir + kullanıcı metriklerini toplar.

-- ─────────────────────────────────────────────────────────────
-- projects: her satır bir iş/uygulama/site
-- ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- project_integrations: bir projeye bağlı veri kaynakları
-- "tek tıkla bağla" — provider seç, config gir, kaydet.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.project_integrations (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  provider          text not null
                    check (provider in ('revenuecat', 'admob', 'posthog', 'supabase')),
  config            jsonb not null default '{}'::jsonb,
  enabled           boolean not null default true,
  last_synced_at    timestamptz,
  last_sync_status  text check (last_sync_status in ('ok', 'error')),
  last_sync_error   text,
  created_at        timestamptz not null default now(),
  unique (project_id, provider)
);

create index if not exists project_integrations_project_idx
  on public.project_integrations (project_id);

-- ─────────────────────────────────────────────────────────────
-- metrics: günlük metrik snapshot'ları (long format — esnek)
-- Yeni metrik tipi eklemek migration gerektirmez.
-- PK (project_id,date,source,metric) → upsert idempotent.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.metrics (
  project_id   uuid not null references public.projects(id) on delete cascade,
  date         date not null,
  source       text not null,   -- revenuecat | admob | posthog | supabase
  metric       text not null,   -- mrr | active_subs | ad_revenue | dau | mau | total_users | new_users
  value        numeric not null default 0,
  ingested_at  timestamptz not null default now(),
  primary key (project_id, date, source, metric)
);

create index if not exists metrics_project_date_idx
  on public.metrics (project_id, date desc);

-- ─────────────────────────────────────────────────────────────
-- RLS — tek kişilik founder paneli: giriş yapan herkes tam yetkili.
-- Edge Function ingestion service_role ile RLS'i bypass eder.
-- ─────────────────────────────────────────────────────────────
alter table public.projects             enable row level security;
alter table public.project_integrations enable row level security;
alter table public.metrics              enable row level security;

create policy "authenticated full access" on public.projects
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.project_integrations
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.metrics
  for all to authenticated using (true) with check (true);
