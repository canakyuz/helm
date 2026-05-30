-- ─────────────────────────────────────────────────────────────
-- payouts: ödeme sağlayıcılarından (Stripe / App Store Connect / Google Play)
-- gelen banka ödemeleri. metrics'ten ayrı (transaksiyonel, günlük-snapshot değil).
-- id = kaynak payout id → idempotent upsert.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payouts (
  id           text primary key,        -- kaynak payout id (Stripe po_..., ASC/Play kendi id)
  project_id   uuid references public.properties(id) on delete cascade,
  source       text not null,           -- stripe | app_store_connect | google_play
  amount       numeric not null,        -- net ödeme (kaynak para biriminde)
  currency     text not null default 'USD',
  status       text not null,           -- pending | in_transit | paid | failed | canceled
  arrival_date date,
  gross        numeric,                 -- opsiyonel (her kaynak vermez)
  fees         numeric,                 -- opsiyonel
  created_at   timestamptz not null default now()
);

create index if not exists payouts_project_arrival_idx
  on public.payouts (project_id, arrival_date desc);

alter table public.payouts enable row level security;

create policy "authenticated full access" on public.payouts
  for all to authenticated using (true) with check (true);
