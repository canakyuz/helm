-- helm-ingest cron'u saat başına çek (önceden 03:00 UTC tek seferdi).
-- Veri yenilenmesi gün içinde güncel kalsın diye: '0 * * * *' (saat başı).

select cron.unschedule('helm-ingest-nightly')
where exists (
  select 1 from cron.job where jobname = 'helm-ingest-nightly'
);

select cron.schedule(
  'helm-ingest-hourly',
  '0 * * * *',
  $job$
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
  $job$
);

-- Job'u kaldırmak için:  select cron.unschedule('helm-ingest-hourly');
