-- helm — review.reply rate limit + cron run history query'leri için composite index.
-- "Son 60s içinde actor X kaç yanıt yazdı?" sorgu desteği.

create index if not exists audit_log_actor_created_idx
  on public.audit_log (actor_email, created_at desc);

-- Mevcut audit_log_actor_idx (sadece actor_email) artık redundant; düşürülmez (rollback kolaylığı)
