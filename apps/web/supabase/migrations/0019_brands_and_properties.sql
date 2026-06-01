-- 0019_brands_and_properties.sql
-- Brand → Property → Module hierarchy.
--   - `brands` tablosu yeni.
--   - `projects` → `properties` rename.
--   - `properties.brand_id` NOT NULL (mevcut veri için 1:1 auto-brand backfill).
--   - `properties.type` enum (website|web_app|mobile_app|desktop_app|game).
--   - `properties.enabled_modules` text[] (modül toggle state).
--
-- FK'lar: project_integrations, metrics, metrics_country, reviews, alert_rules,
-- heartbeats, user_segments, app_versions, audit_log, campaigns, cms_collections,
-- cms_entries, cms_assets — hepsi `project_id` kolon adıyla `properties.id`'yi
-- referans alır (kolon adı rename edilmedi; geri-uyumluluk).

begin;

-- 1) Property type enum
create type property_type as enum ('website','web_app','mobile_app','desktop_app','game');

-- 2) Brands tablosu
create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.brands enable row level security;
create policy brands_authenticated_all on public.brands
  for all to authenticated using (true) with check (true);

-- 3) Mevcut projects için 1:1 brand auto-create
insert into public.brands (id, name, slug, created_at)
select gen_random_uuid(), name, slug, created_at
from public.projects
on conflict (slug) do nothing;

-- 4) projects → properties rename
alter table public.projects rename to properties;

-- 5) properties.brand_id ekle, backfill, NOT NULL
alter table public.properties add column brand_id uuid references public.brands(id) on delete restrict;

update public.properties p
   set brand_id = b.id
  from public.brands b
 where p.slug = b.slug;

alter table public.properties alter column brand_id set not null;
create index properties_brand_idx on public.properties(brand_id);

-- 6) properties.type — default 'mobile_app' (post-migration manuel düzeltme)
alter table public.properties add column type property_type not null default 'mobile_app';

-- 7) properties.enabled_modules — boş array default, app-side preset doldurur
alter table public.properties add column enabled_modules text[] not null default '{}';

-- 8) Geri-uyumlu view: eski `projects` adıyla read-only erişim
--    Faz 10'da DROP edilecek; UI aşamalı geçiş bitince.
create view public.projects as
  select id, name, slug, created_at, app_store_id, app_store_country
    from public.properties;

commit;
