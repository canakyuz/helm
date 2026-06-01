-- helm-ingest gece otomasyonu — pg_cron + pg_net.
-- helm-ingest Edge Function'ı her gece 03:00 UTC'de çalıştırır.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─────────────────────────────────────────────────────────────
-- ÖNCE: aşağıdaki iki satırı GERÇEK hub değerleriyle doldurup
-- Supabase SQL Editor'da bir kez çalıştır (migration ile değil):
--
--   select vault.create_secret('https://<HUB-REF>.supabase.co', 'helm_project_url');
--   select vault.create_secret('<HUB-SERVICE-ROLE-KEY>',        'helm_service_role_key');
--
-- (Project Settings → API'den alınır. Vault'a yazıldıktan sonra
--  cron job bunları çalışma anında okur.)
-- ─────────────────────────────────────────────────────────────

select cron.schedule(
  'helm-ingest-nightly',
  '0 3 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'helm_project_url'
    ) || '/functions/v1/helm-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'helm_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Job'u kaldırmak için:  select cron.unschedule('helm-ingest-nightly');
