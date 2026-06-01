-- helm — müdahale kayıt günlüğü (CRM → Müdahale Geçmişi).
-- İleride helm-action fonksiyonu (gem ver / ban vb.) buraya yazacak.

create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  project_id   uuid references public.projects(id) on delete cascade,
  target_user  text,
  action       text not null,
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "authenticated read" on public.audit_log
  for select to authenticated using (true);
