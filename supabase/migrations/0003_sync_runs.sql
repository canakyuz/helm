-- helm — senkron çalışma kayıtları (gözlemlenebilirlik).
-- helm-ingest her çalıştığında bir satır yazar: ne zaman, kaç metrik, hata var mı.

create table if not exists public.sync_runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  trigger       text not null default 'manual'
                check (trigger in ('manual', 'cron')),
  ingested      integer not null default 0,
  ok_count      integer not null default 0,
  error_count   integer not null default 0,
  details       jsonb
);

create index if not exists sync_runs_started_idx
  on public.sync_runs (started_at desc);

alter table public.sync_runs enable row level security;

-- Panel (authenticated) okur; Edge Function (service_role) yazar.
create policy "authenticated read" on public.sync_runs
  for select to authenticated using (true);
