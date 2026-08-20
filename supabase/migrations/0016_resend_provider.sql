-- Resend (mail) sağlayıcısı - kampanya gönderimi için.
-- helm-send-mail edge function bu entegrasyondan api_key + from_email okur.

alter table public.project_integrations
  drop constraint if exists project_integrations_provider_check;

alter table public.project_integrations
  add constraint project_integrations_provider_check
  check (
    provider in (
      'revenuecat', 'admob', 'posthog', 'supabase',
      'stripe', 'plausible', 'rest', 'sentry',
      'app_store_connect', 'resend'
    )
  );

-- Gönderim geçmişi (basit log - Mail + Push'tan ortak kullanır).
create table if not exists public.campaigns (
  id          bigint generated always as identity primary key,
  project_id  uuid references public.projects(id) on delete set null,
  segment_id  uuid references public.user_segments(id) on delete set null,
  channel     text not null check (channel in ('mail', 'push')),
  subject     text,
  body        text,
  recipients  integer not null default 0,
  sent        integer not null default 0,
  failed      integer not null default 0,
  error       text,
  sent_at     timestamptz not null default now()
);

create index if not exists campaigns_sent_idx
  on public.campaigns (sent_at desc);

alter table public.campaigns enable row level security;
drop policy if exists "authenticated full access" on public.campaigns;
create policy "authenticated full access" on public.campaigns
  for all to authenticated using (true) with check (true);
