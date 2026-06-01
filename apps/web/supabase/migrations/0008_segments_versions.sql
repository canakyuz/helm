-- helm — kullanıcı segmentleri + uygulama sürüm takibi.

-- Kayıtlı kullanıcı segmentleri (CRM → Segmentler).
create table if not exists public.user_segments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  project_id  uuid references public.projects(id) on delete cascade,
  rule_type   text not null check (rule_type in ('new', 'active', 'inactive')),
  rule_days   integer not null default 7,
  created_at  timestamptz not null default now()
);

alter table public.user_segments enable row level security;
create policy "authenticated full access" on public.user_segments
  for all to authenticated using (true) with check (true);

-- App Store sürüm geçmişi (DevOps → Sürümler).
create table if not exists public.app_versions (
  id             bigint generated always as identity primary key,
  project_id     uuid not null references public.projects(id) on delete cascade,
  version        text not null,
  release_date   timestamptz,
  release_notes  text,
  fetched_at     timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists app_versions_project_idx
  on public.app_versions (project_id, release_date desc);

alter table public.app_versions enable row level security;
create policy "authenticated read" on public.app_versions
  for select to authenticated using (true);
