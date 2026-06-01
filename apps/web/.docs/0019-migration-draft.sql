-- ==========================================================================
-- 0019_brands_and_properties.sql — TASLAK referansı (asıl dosya: supabase/migrations/0019_*.sql)
-- ==========================================================================
-- Amaç: Brand → Property → Module hierarchy'ine geçiş.
--   - `brands` tablosu yeni.
--   - `projects` → `properties` rename.
--   - `properties.brand_id` NOT NULL (mevcut veri için 1:1 auto-brand backfill).
--   - `properties.type` enum (website|web_app|mobile_app|desktop_app|game).
--   - `properties.enabled_modules` text[] (modül toggle state).
--
-- DİKKAT — mevcut FK'lar:
--   project_integrations.project_id, metrics.project_id, metrics_country.project_id,
--   reviews.project_id, alert_rules.project_id (nullable), heartbeats.project_id (nullable),
--   user_segments.project_id, app_versions.project_id, audit_log.project_id (nullable),
--   campaigns.project_id (nullable), cms_collections.project_id, cms_entries.project_id,
--   cms_assets.project_id
--
-- TÜM bu FK'ların hedef tablosu rename'den sonra otomatik güncellenir (PG davranışı),
-- AMA: kolon adını `project_id` olarak BIRAKIYORUZ (rename etmiyoruz) çünkü kodbase'te
-- 17 resource + bütün queries `project_id` kullanıyor. "property_id" rename ayrı PR.
-- ==========================================================================

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
--    (Her project_id için aynı slug'a sahip bir brand oluştur, sonra bağla.)
insert into public.brands (id, name, slug, created_at)
select gen_random_uuid(), name, slug, created_at
from public.projects
on conflict (slug) do nothing;

-- 4) projects → properties rename
alter table public.projects rename to properties;

-- 5) properties.brand_id ekle (önce nullable, backfill, sonra NOT NULL)
alter table public.properties add column brand_id uuid references public.brands(id) on delete restrict;

update public.properties p
   set brand_id = b.id
  from public.brands b
 where p.slug = b.slug;

alter table public.properties alter column brand_id set not null;
create index properties_brand_idx on public.properties(brand_id);

-- 6) properties.type — tüm mevcut property'ler default 'mobile_app' (kullanıcı sonra düzeltir)
--    Empire Inc + Friday + Dante şu an mobile/SaaS karışık, manuel onay sonrası UPDATE çalıştırılır.
alter table public.properties add column type property_type not null default 'mobile_app';

-- 7) properties.enabled_modules — boş array default, app code'unda preset'e göre doldurulur
alter table public.properties add column enabled_modules text[] not null default '{}';

-- 8) Geri-uyumlu view: eski `projects` adıyla read-only erişim (eski kod kırılmasın diye)
--    Bu view IN PLACE — Refine'in projects resource'u henüz update edilmediği sürece sorunsuz.
--    UI migrasyonu bittikten sonra DROP edilecek.
create view public.projects as
  select id, name, slug, created_at, app_store_id, app_store_country
    from public.properties;

-- 9) RLS — properties tablo seviyesinde aynı policy (rename ile policy taşınır, manuel adım yok)
--    Audit: pg_policies'ten kontrol et — bazı PG versiyonlarında policy adı tabloyla bağlı.

commit;

-- ==========================================================================
-- ROLLBACK (geri alma)
-- ==========================================================================
-- begin;
--   drop view if exists public.projects;
--   alter table public.properties drop column enabled_modules;
--   alter table public.properties drop column type;
--   alter table public.properties drop column brand_id;
--   alter table public.properties rename to projects;
--   drop table if exists public.brands;
--   drop type if exists property_type;
-- commit;
--
-- NOT: Drop type sırasında 'mobile_app' default'a bağlı kolon varsa CASCADE gerekebilir.
-- ==========================================================================

-- ==========================================================================
-- POST-MIGRATION TODO (kullanıcı manuel onayı ile)
-- ==========================================================================
-- 1) Her property'nin type'ını doğru set et (UI ile veya SQL):
--      update public.properties set type = 'mobile_app' where slug in ('empire','dante-mobile');
--      update public.properties set type = 'website'    where slug = 'van';
--      update public.properties set type = 'web_app'    where slug = 'friday';
--
-- 2) enabled_modules'u preset'e göre doldur (UI ilk açılışta auto-fill):
--      update public.properties
--         set enabled_modules = case type
--             when 'website'     then array['content','analytics']
--             when 'web_app'     then array['users','analytics','subscriptions','funnel']
--             when 'mobile_app'  then array['users','analytics','subscriptions','ads','reviews','funnel','push']
--             when 'desktop_app' then array['users','analytics']
--             when 'game'        then array['users','analytics','ads','reviews','funnel','push']
--         end
--       where enabled_modules = '{}';
--
-- 3) Brand seviyesinde gruplama — şu an her property'nin kendi brand'i (1:1). Manuel:
--      -- Dante markası altında 3 property birleştirme örneği:
--      with dante as (insert into brands (name, slug) values ('Dante', 'dante-group')
--                     on conflict (slug) do update set name = excluded.name returning id)
--      update properties set brand_id = (select id from dante)
--       where slug in ('dante-mobile', 'dante-web', 'dante-com');
--      delete from brands where slug in ('dante-mobile','dante-web','dante-com')
--        and id not in (select brand_id from properties);
