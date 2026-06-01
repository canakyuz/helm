-- helm — app_versions v2: TestFlight + App Store Connect entegrasyonu.
-- iTunes lookup sadece publicly released sürümü döner; ASC API ile
-- appStoreVersions + preReleaseVersions + builds çekilince satır başına
-- status + build_number + expires_at bilgisi de tutmamız gerekiyor.

alter table public.app_versions
  add column if not exists status            text,
  add column if not exists build_number      text,
  add column if not exists expires_at        timestamptz,
  add column if not exists state_changed_at  timestamptz;

-- Mevcut unique key (project_id, source, version) TestFlight için yetersiz —
-- aynı 1.0.0 versiyonu birden fazla build (23/24/26/29/30) içerebilir.
-- build_number dahil et; NULL'lar Postgres'te distinct sayılmaz (iTunes lookup
-- canlı sürüm satırı = build_number NULL → tek kayıt kalır, çatışmaz).
alter table public.app_versions
  drop constraint if exists app_versions_project_source_version_key;
alter table public.app_versions
  add constraint app_versions_project_source_version_build_key
  unique (project_id, source, version, build_number);

comment on column public.app_versions.status is
  'Apple/Play state: live | in_review | ready | testflight | rejected | expired (UI mapping helm-versions tarafında)';
comment on column public.app_versions.build_number is
  'TestFlight/internal build number (Apple), null iTunes lookup canlı sürüm için';
comment on column public.app_versions.expires_at is
  'TestFlight build expiry (90 gün); App Store yayında olan için null';

create index if not exists app_versions_status_idx
  on public.app_versions (project_id, source, status);
