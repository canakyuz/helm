-- App Store Connect connector - günlük satış raporları (indirme + gelir).

alter table public.project_integrations
  drop constraint if exists project_integrations_provider_check;

alter table public.project_integrations
  add constraint project_integrations_provider_check
  check (
    provider in (
      'revenuecat', 'admob', 'posthog', 'supabase',
      'stripe', 'plausible', 'rest', 'sentry',
      'app_store_connect'
    )
  );
