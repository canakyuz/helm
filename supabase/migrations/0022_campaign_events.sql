-- Mail kampanya event tracking (Resend webhooks).
-- helm-resend-webhook bu tabloya yazar; Mail/Campaigns sayfaları open/click
-- oranlarını burdan çeker.

create table if not exists public.campaign_events (
  id          bigint generated always as identity primary key,
  campaign_id bigint references public.campaigns(id) on delete cascade,
  email_id    text not null,
  event       text not null check (event in (
    'sent','delivered','opened','clicked','bounced','complained'
  )),
  recipient   text,
  url         text,                              -- clicked event'inde target URL
  user_agent  text,
  occurred_at timestamptz not null default now()
);

create index if not exists campaign_events_campaign_idx
  on public.campaign_events (campaign_id, event);

create index if not exists campaign_events_email_idx
  on public.campaign_events (email_id);

alter table public.campaign_events enable row level security;
drop policy if exists "authenticated full access" on public.campaign_events;
create policy "authenticated full access" on public.campaign_events
  for all to authenticated using (true) with check (true);
