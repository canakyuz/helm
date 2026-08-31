-- helm - gece cron'unu aktifleştir (P0.1)
--
-- KULLANIM:
--   1) Supabase Dashboard → SQL Editor'ü aç.
--   2) Aşağıdaki <SERVICE_ROLE_KEY> alanını gerçek key ile değiştir
--      (Project Settings → API → service_role / secret).
--   3) Tüm dosyayı kopyala-yapıştır, Run.
--   4) Çıktıdaki son SELECT'i kontrol et - 'helm-ingest-nightly' satırı olmalı.
--
-- Bu dosya idempotent: tekrar çalıştırırsan secret'ları günceller,
-- cron job'unu (varsa) silip yeniden kurar.

-- Hub URL (helm'in kendisi - bu dosya hub repo'sundaki helm projesi için):
--   https://YOUR_PROJECT_REF.supabase.co
do $$
declare
  v_url constant text := 'https://YOUR_PROJECT_REF.supabase.co';
  v_srk constant text := '<SERVICE_ROLE_KEY>';
  v_existing uuid;
begin
  if v_srk = '<SERVICE_ROLE_KEY>' or length(v_srk) < 40 then
    raise exception
      'service_role_key girilmedi. Project Settings → API → service_role.';
  end if;

  -- helm_project_url
  select id into v_existing from vault.secrets where name = 'helm_project_url';
  if v_existing is null then
    perform vault.create_secret(v_url, 'helm_project_url');
  else
    perform vault.update_secret(v_existing, v_url, 'helm_project_url');
  end if;

  -- helm_service_role_key
  select id into v_existing from vault.secrets where name = 'helm_service_role_key';
  if v_existing is null then
    perform vault.create_secret(v_srk, 'helm_service_role_key');
  else
    perform vault.update_secret(v_existing, v_srk, 'helm_service_role_key');
  end if;
end $$;

-- Cron job'unu yeniden kur (yoksa oluşturur, varsa overwrite eder).
-- Eski adlandırma (helm-ingest-nightly) varsa onu da temizle.
select cron.unschedule(jobname)
from cron.job
where jobname in ('helm-ingest-nightly', 'helm-ingest-hourly');

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

-- Doğrulama: cron job + son secret'lar listelensin.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'helm-ingest-hourly';

select name, created_at, updated_at
from vault.secrets
where name in ('helm_project_url', 'helm_service_role_key')
order by name;

-- (Opsiyonel) hemen bir kez tetikle - gece beklemeden test:
-- select net.http_post(
--   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/helm-ingest',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer ' || (
--       select decrypted_secret from vault.decrypted_secrets
--       where name = 'helm_service_role_key'
--     )
--   ),
--   body := '{}'::jsonb
-- );
