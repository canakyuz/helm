-- metrics_country — günlük metrik kırılımı (ülke bazlı).
-- Ana metrics tablosunu kirletmemek için ayrı tablo.
-- PK (project_id, date, source, metric, country_code) → upsert idempotent.

create table if not exists public.metrics_country (
  project_id    uuid not null references public.projects(id) on delete cascade,
  date          date not null,
  source        text not null,
  metric        text not null,
  country_code  text not null,           -- ISO 3166-1 alpha-2 (US, TR, DE...)
  value         numeric not null default 0,
  ingested_at   timestamptz not null default now(),
  primary key (project_id, date, source, metric, country_code)
);

create index if not exists metrics_country_project_date_idx
  on public.metrics_country (project_id, date desc);

create index if not exists metrics_country_metric_idx
  on public.metrics_country (metric, date desc);

alter table public.metrics_country enable row level security;

drop policy if exists "authenticated full access" on public.metrics_country;
create policy "authenticated full access" on public.metrics_country
  for all to authenticated using (true) with check (true);
