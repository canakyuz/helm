-- helm — tetiklenen uyarı olayları. helm-alert fonksiyonu yazar; panel okur.

create table if not exists public.alert_events (
  id               bigint generated always as identity primary key,
  rule_id          uuid references public.alert_rules(id) on delete cascade,
  triggered_at     timestamptz not null default now(),
  metric           text not null,
  current_value    numeric,
  reference_value  numeric,
  message          text not null,
  delivered        boolean not null default false
);

create index if not exists alert_events_triggered_idx
  on public.alert_events (triggered_at desc);

alter table public.alert_events enable row level security;

drop policy if exists "authenticated read" on public.alert_events;
create policy "authenticated read" on public.alert_events
  for select to authenticated using (true);
