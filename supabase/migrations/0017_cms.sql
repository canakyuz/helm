-- helm — CMS modülü: çok-projeli içerik yönetimi
-- Şemalar (cms_collections.jsonb) + entries (jsonb data, locale, draft/published)
-- + revisions (publish snapshot) + assets (Supabase Storage).
-- Helm RLS konvansiyonu: authenticated tam yetkili; anon sadece published okur.

-- ─────────────────────────────────────────────────────────────
-- cms_collections: schema-as-data. Her satır bir collection ya da singleton.
-- schema jsonb şeklinde { fields: FieldDef[] }.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.cms_collections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  slug        text not null,
  label       text not null,
  kind        text not null
              check (kind in ('collection', 'singleton')),
  schema      jsonb not null default '{"fields":[]}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, slug)
);

create index if not exists cms_collections_project_idx
  on public.cms_collections (project_id);

-- ─────────────────────────────────────────────────────────────
-- cms_entries: gerçek içerik. data jsonb schema'ya uyar.
-- project_id denormalize — anon RLS ve listeleme hızı için.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.cms_entries (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.cms_collections(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  slug          text not null,
  locale        text not null default 'en',
  status        text not null default 'draft'
                check (status in ('draft', 'published')),
  data          jsonb not null default '{}'::jsonb,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  unique (collection_id, slug, locale)
);

create index if not exists cms_entries_collection_status_idx
  on public.cms_entries (collection_id, status);
create index if not exists cms_entries_project_status_idx
  on public.cms_entries (project_id, status);
create index if not exists cms_entries_updated_idx
  on public.cms_entries (updated_at desc);

-- project_id otomatik doldur (collection'dan miras)
create or replace function public.cms_entries_set_project_id()
returns trigger language plpgsql as $$
begin
  if new.project_id is null then
    select project_id into new.project_id
      from public.cms_collections
     where id = new.collection_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cms_entries_project_id_trg on public.cms_entries;
create trigger cms_entries_project_id_trg
  before insert on public.cms_entries
  for each row execute function public.cms_entries_set_project_id();

-- updated_at otomatik güncelle
create or replace function public.cms_entries_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cms_entries_updated_at_trg on public.cms_entries;
create trigger cms_entries_updated_at_trg
  before update on public.cms_entries
  for each row execute function public.cms_entries_touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- cms_revisions: her publish snapshot. Rollback için.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.cms_revisions (
  id                  bigserial primary key,
  entry_id            uuid not null references public.cms_entries(id) on delete cascade,
  data                jsonb not null,
  status_at_snapshot  text,
  note                text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

create index if not exists cms_revisions_entry_idx
  on public.cms_revisions (entry_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- cms_assets: medya kütüphanesi. Dosya Supabase Storage'da; bu tablo metadata.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.cms_assets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  storage_path  text not null unique,
  filename      text not null,
  mime          text,
  bytes         bigint,
  width         int,
  height        int,
  alt           text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists cms_assets_project_idx
  on public.cms_assets (project_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- RLS — helm konvansiyonu: authenticated tam yetkili.
-- Anon sadece published entry / public schema / public asset okur.
-- ─────────────────────────────────────────────────────────────
alter table public.cms_collections enable row level security;
alter table public.cms_entries     enable row level security;
alter table public.cms_revisions   enable row level security;
alter table public.cms_assets      enable row level security;

create policy "authenticated full access" on public.cms_collections
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.cms_entries
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.cms_revisions
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.cms_assets
  for all to authenticated using (true) with check (true);

-- Anon public read (Friday vb. public siteler için)
create policy "anon read published entries" on public.cms_entries
  for select to anon using (status = 'published');

create policy "anon read collection schemas" on public.cms_collections
  for select to anon using (true);

create policy "anon read assets" on public.cms_assets
  for select to anon using (true);

-- ─────────────────────────────────────────────────────────────
-- Storage bucket: cms-assets (public read, authenticated write).
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('cms-assets', 'cms-assets', true)
on conflict (id) do nothing;

create policy "cms-assets auth upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cms-assets');

create policy "cms-assets auth update" on storage.objects
  for update to authenticated
  using (bucket_id = 'cms-assets');

create policy "cms-assets auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cms-assets');

create policy "cms-assets public read" on storage.objects
  for select to anon
  using (bucket_id = 'cms-assets');
