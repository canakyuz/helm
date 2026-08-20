-- Audit log'a "kim yaptı" izlemesi - multi-user setup hazırlığı.
-- helm-action her insert'te actor_email set eder (JWT'den çıkarılır).

alter table public.audit_log
  add column if not exists actor_email text;

create index if not exists audit_log_actor_idx
  on public.audit_log (actor_email);
