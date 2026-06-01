-- Google Play Developer sağlayıcısı — Android yorumları + sürüm tracks API'si için.
-- helm-reviews ve helm-versions Edge Function'ları bu entegrasyondan
-- service_account_json + package_name + language_codes okur.

alter table public.project_integrations
  drop constraint if exists project_integrations_provider_check;

alter table public.project_integrations
  add constraint project_integrations_provider_check
  check (
    provider in (
      'revenuecat', 'admob', 'posthog', 'supabase',
      'stripe', 'plausible', 'rest', 'sentry',
      'app_store_connect', 'resend', 'google_play_developer'
    )
  );
