-- Play Store sürüm desteği.
--   - properties.google_play_id (package name) + google_play_country
--   - app_versions.source enum (ios | android)
--   - Unique constraint güncellendi: (project_id, source, version)

alter table public.properties
  add column if not exists google_play_id text,
  add column if not exists google_play_country text default 'us';

alter table public.app_versions
  add column if not exists source text not null default 'ios';

alter table public.app_versions
  drop constraint if exists app_versions_source_check;
alter table public.app_versions
  add constraint app_versions_source_check
  check (source in ('ios', 'android'));

-- Eski unique constraint'i bul ve değiştir (migration 0008'de
-- "unique (project_id, version)" var, kolon adı autogen)
alter table public.app_versions
  drop constraint if exists app_versions_project_id_version_key;

alter table public.app_versions
  drop constraint if exists app_versions_project_source_version_key;
alter table public.app_versions
  add constraint app_versions_project_source_version_key
  unique (project_id, source, version);
