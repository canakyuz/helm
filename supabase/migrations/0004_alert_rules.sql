-- helm - uyarı kuralları. Uyarılar modülü bunları okur/yazar;
-- ileride helm-alert fonksiyonu senkron sonrası değerlendirir.

create table if not exists public.alert_rules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  project_id  uuid references public.projects(id) on delete cascade, -- null = tüm projeler
  metric      text not null,            -- dau | ad_revenue | mrr | total_users ...
  condition   text not null
              check (condition in ('drop_pct', 'rise_pct', 'below', 'above')),
  threshold   numeric not null,
  channel     text not null default 'telegram'
              check (channel in ('telegram', 'email')),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.alert_rules enable row level security;

drop policy if exists "authenticated full access" on public.alert_rules;
create policy "authenticated full access" on public.alert_rules
  for all to authenticated using (true) with check (true);
