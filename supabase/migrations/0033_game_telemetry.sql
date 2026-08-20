-- helm — oyun telemetrisi (Sentry'siz). İstemci oyunlar (Godot vb.) doğrudan
-- helm-game-ingest fonksiyonuna event POST eder: hata/crash, session, FPS, reklam,
-- satın alma. Ham event'ler game_events'e yazılır; günlük sayımlar metrics'e
-- (source='game') idempotent upsert edilir → mevcut panel/alert akışına girer.
--
-- Auth: properties.ingest_token (tahmin edilemez UUID). Oyun bunu .env'inde tutar;
-- token UI'dan / Supabase'den okunur. JWT istemez (--no-verify-jwt ile deploy).

-- Per-app push token (tüm property'lere otomatik atanır).
alter table public.properties
  add column if not exists ingest_token uuid not null default gen_random_uuid();

create unique index if not exists idx_properties_ingest_token
  on public.properties (ingest_token);

-- Ham oyun event'leri.
create table if not exists public.game_events (
  id           bigint generated always as identity primary key,
  project_id   uuid not null references public.properties (id) on delete cascade,
  event_type   text not null check (event_type in ('error', 'crash', 'session', 'metric', 'ad', 'purchase')),
  event_key    text,                       -- 'script_error', 'banner', 'fps_p95', 'remove_ads'...
  value        numeric,                    -- sayısal veri (fps, tutar, süre sn...)
  details      jsonb,                      -- serbest bağlam (stack, mod, ekran...)
  app_version  text,
  platform     text,                       -- 'iOS' | 'Android'
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists idx_game_events_project_time
  on public.game_events (project_id, occurred_at desc);

create index if not exists idx_game_events_type
  on public.game_events (project_id, event_type, occurred_at desc);

alter table public.game_events enable row level security;

-- Panel (authenticated) okur; yazımı yalnız service role (helm-game-ingest) yapar
-- (service role RLS'i bypass eder, ayrı insert policy gerekmez).
drop policy if exists "authenticated read game_events" on public.game_events;
create policy "authenticated read game_events" on public.game_events
  for select to authenticated using (true);
