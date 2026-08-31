-- 0049 - helm-embed saatlik cron.
--
-- Yorumlar 30 dakikada bir cekiliyor (0026); gomuleme saatlik kosuyor, yani
-- yeni bir yorum en gec bir saat icinde aranabilir hale geliyor. Daha sik
-- kosmanin faydasi yok: helm_pending_embeddings zaten bos donerse fonksiyon
-- hicbir sey yapmadan cikiyor, ama her kosu yine de bir OpenAI cagrisi riski
-- tasiyor - gereksiz siklik dogrudan para demek.
--
-- 0002_cron.sql ve 0026_reviews_cron.sql ile ayni vault deseni.

select cron.schedule(
  'helm-embed-hourly',
  '20 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'helm_project_url'
    ) || '/functions/v1/helm-embed',
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

-- Kaldirmak icin:  select cron.unschedule('helm-embed-hourly');
