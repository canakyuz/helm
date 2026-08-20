-- helm - store yorumları. App Store yorum RSS'i (auth gerektirmez) çekilir.
-- Proje, App Store ID'siyle eşlenir.

alter table public.projects
  add column if not exists app_store_id text;
alter table public.projects
  add column if not exists app_store_country text not null default 'us';

create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  project_id   uuid not null references public.projects(id) on delete cascade,
  source       text not null default 'appstore',
  external_id  text,
  author       text,
  rating       integer,
  title        text,
  body         text,
  review_date  timestamptz,
  fetched_at   timestamptz not null default now(),
  unique (project_id, source, external_id)
);

create index if not exists reviews_project_date_idx
  on public.reviews (project_id, review_date desc);

alter table public.reviews enable row level security;

drop policy if exists "authenticated read" on public.reviews;
create policy "authenticated read" on public.reviews
  for select to authenticated using (true);
