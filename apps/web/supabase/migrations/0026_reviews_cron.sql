-- helm-reviews 30dk cron. Manuel "Yenile" yerine otomatik tazeleme.
-- vault.decrypted_secrets pattern'i 0002_cron.sql ile aynı (helm_project_url + helm_service_role_key).

select cron.schedule(
  'helm-reviews-30m',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'helm_project_url'
    ) || '/functions/v1/helm-reviews',
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

-- Job'u kaldırmak için:  select cron.unschedule('helm-reviews-30m');
