-- helm — heartbeat izleyiciler. Beklenen periyodik ping gelmezse iş ölmüş
-- demektir (cron job, push-scheduler vb.). helm-heartbeat fonksiyonu
-- ping'leri kaydeder; panel son ping'e bakıp sağlık hesaplar.

create table if not exists public.heartbeats (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  project_id        uuid references public.projects(id) on delete cascade,
  interval_minutes  integer not null default 1440,  -- beklenen ping aralığı
  last_ping_at      timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.heartbeats enable row level security;

create policy "authenticated full access" on public.heartbeats
  for all to authenticated using (true) with check (true);
