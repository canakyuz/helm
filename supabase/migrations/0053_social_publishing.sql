-- 0053 - Sosyal icerik kutuphanesi, yayin kuyrugu ve Zernio'ya pg_net ile gonderim.
--
-- NEDEN VERITABANI GONDERIYOR: edge function deploy edilemiyor (Management API
-- token'i yok) ve Zernio anahtari istemciye inemez (paketler public). Istemci
-- yalnizca security definer RPC cagirir; RPC istegi pg_net kuyruguna atar,
-- anahtari Vault'tan (zernio_api_key) okur. pg_net asenkron: yanit ayni
-- transaction'da gelmez, bu yuzden istek id'si social_net_requests'e yazilir ve
-- dakikalik helm_social_collect yaniti isler. Webhook yerine 5 dakikalik yenileme.
--
-- NEDEN "SIMDI PAYLAS" = 2 DAKIKA SONRASI: publishNow senkron video yuklemesi
-- yapar ve pg_net zaman asimini kolayca asar; sonuc belirsiz kalir. Planli post
-- Zernio'da aninda doner.
--
-- Spec: docs/superpowers/specs/2026-09-14-zernio-sp2-publishing-design.md
--
-- Istemci yuzeyi (authenticated):
--   helm_social_publish(uuid, text[], timestamptz default null) -> uuid
--   helm_social_schedule_all(uuid, text[] default '{tiktok,instagram}') -> int
--   helm_social_cancel(uuid) -> void
--   helm_social_refresh() -> void
-- Ic: helm_social_collect() (cron her dakika) + yardimcilar (kimseye grant yok).

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create table if not exists public.social_library (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.properties(id) on delete cascade,
  campaign text not null,
  code text not null,
  sort_order integer not null default 0,
  hook text not null default '',
  voice text,
  -- Zernio presign publicUrl. Import yuklemeden once satir yazmaz; yine de
  -- nullable, cunku yayin RPC'si bos URL'yi kendisi reddediyor.
  video_url text,
  thumbnail_url text,
  duration_sec numeric,
  tiktok_caption text not null default '',
  instagram_caption text not null default '',
  pinned_comment text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.properties(id) on delete cascade,
  library_id uuid references public.social_library(id) on delete set null,
  zernio_post_id text unique,
  status text not null check (
    status in ('sending', 'scheduled', 'publishing', 'published', 'partial', 'failed', 'cancelled')
  ),
  scheduled_for timestamptz,
  published_at timestamptz,
  -- [{platform, account_id, status, url, error}]
  platforms jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_posts_project_scheduled
  on public.social_posts (project_id, scheduled_for);

-- NEDEN UNIQUE PARTIAL INDEX: publish RPC'deki "aktif post var mi" kontrolu
-- tek basina iki eszamanli dokunusta yarisir. Index ayni kutuphane ogesine
-- ikinci aktif postu fiziksel olarak engeller (cift paylasim = kalici hata).
create unique index if not exists uq_social_posts_active_library
  on public.social_posts (library_id)
  where status in ('sending', 'scheduled', 'publishing', 'published', 'partial');

-- Refresh cron'unun "bekleyen post var mi" kontrolu icin kucuk partial index.
create index if not exists idx_social_posts_pending
  on public.social_posts (status)
  where status in ('sending', 'scheduled', 'publishing');

-- pg_net istek takibi. Istemciye tamamen kapali.
create table if not exists public.social_net_requests (
  request_id bigint primary key,
  kind text not null check (kind in ('create', 'cancel', 'refresh')),
  post_id uuid references public.social_posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.social_library enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_net_requests enable row level security;

drop policy if exists "authenticated read social_library" on public.social_library;
create policy "authenticated read social_library" on public.social_library
  for select to authenticated using (true);

drop policy if exists "authenticated read social_posts" on public.social_posts;
create policy "authenticated read social_posts" on public.social_posts
  for select to authenticated using (true);

-- Yazma yalnizca RPC uzerinden. RLS zaten engelliyor; grant'i da kaldirmak
-- ileride yanlislikla eklenen bir "for all" politikasina karsi ikinci kilit.
revoke insert, update, delete, truncate on public.social_library from anon, authenticated;
revoke insert, update, delete, truncate on public.social_posts from anon, authenticated;
revoke all on public.social_net_requests from anon, authenticated;

create or replace function public.helm_social_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists social_library_updated_at_trg on public.social_library;
create trigger social_library_updated_at_trg
  before update on public.social_library
  for each row execute function public.helm_social_touch_updated_at();

drop trigger if exists social_posts_updated_at_trg on public.social_posts;
create trigger social_posts_updated_at_trg
  before update on public.social_posts
  for each row execute function public.helm_social_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Yardimcilar (ic, grant yok)
-- ---------------------------------------------------------------------------

-- Cagiran dogrulamasi. Gecerli: JWT'li kullanici, service_role, ya da istemci
-- rolune gecmemis ham postgres oturumu (pg_cron, migration, bakim).
-- NEDEN current_setting('role'): security definer icinde current_user sahibe
-- (postgres) doner ama 'role' GUC'u cagiranin `set role authenticated`
-- degerini korur (canli dogrulandi). Yani PostgREST'ten gelen JWT'siz
-- authenticated/anon cagri postgres gibi gorunemez.
-- Time: O(1)
create or replace function public.helm_social_assert_caller()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if auth.uid() is not null then return; end if;
  if coalesce(auth.role(), '') = 'service_role' then return; end if;
  if session_user = 'postgres' and current_setting('role') = 'none' then return; end if;
  raise exception 'helm: oturum gerekli' using errcode = '42501';
end;
$$;

create or replace function public.helm_social_active_statuses()
returns text[]
language sql
immutable
as $$ select array['sending', 'scheduled', 'publishing', 'published', 'partial'] $$;

-- Platform listesini dogrular ve tekillestirir (sirayi korur). Time: O(p), p <= 2.
create or replace function public.helm_social_normalize_platforms(p_platforms text[])
returns text[]
language plpgsql
immutable
as $$
declare
  v_out text[];
begin
  select array_agg(platform order by first_ord) into v_out
  from (
    select lower(btrim(x)) as platform, min(ord) as first_ord
    from unnest(p_platforms) with ordinality u(x, ord)
    where x is not null and btrim(x) <> ''
    group by lower(btrim(x))
  ) d;

  if v_out is null then
    raise exception 'helm: en az bir platform secilmeli' using errcode = '22023';
  end if;
  if not v_out <@ array['tiktok', 'instagram'] then
    raise exception 'helm: desteklenmeyen platform (yalnizca tiktok, instagram)' using errcode = '22023';
  end if;
  return v_out;
end;
$$;

create or replace function public.helm_social_zernio_url(p_path text)
returns text
language sql
immutable
as $$ select 'https://zernio.com/api/v1' || p_path $$;

-- Anahtar Vault'tan her istekte okunur: rotate edildiginde migration gerekmez.
create or replace function public.helm_social_zernio_headers()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'zernio_api_key';

  if v_key is null or v_key = '' then
    raise exception 'helm: zernio_api_key Vault''ta yok' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_key
  );
end;
$$;

-- JSON olmayan govde (HTML 502 vb.) collect'i patlatmasin. Time: O(len)
create or replace function public.helm_social_try_jsonb(p_text text)
returns jsonb
language plpgsql
immutable
as $$
begin
  return p_text::jsonb;
exception when others then
  return null;
end;
$$;

-- Zernio hata govdesinden kisa, anahtarsiz mesaj. <= 500 karakter.
-- Anahtar Zernio yanitinda olmamali; yine de birebir eslesme ve Bearer kalibi
-- maskelenir - hata metni istemciye okunur bir kolona yaziliyor.
create or replace function public.helm_social_error_text(p_status integer, p_content text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_body jsonb := public.helm_social_try_jsonb(p_content);
  v_msg text;
  v_key text;
begin
  v_msg := coalesce(v_body ->> 'error', v_body ->> 'message', p_content, '');
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'zernio_api_key';
  if v_key is not null and v_key <> '' then
    v_msg := replace(v_msg, v_key, '[redacted]');
  end if;
  v_msg := regexp_replace(v_msg, 'Bearer\s+\S+', 'Bearer [redacted]', 'gi');
  return left('Zernio ' || coalesce(p_status::text, '?') || ': ' || v_msg, 500);
end;
$$;

-- Zernio post durumu -> Helm durumu. Bilinmeyen deger mevcut durumu korur.
create or replace function public.helm_social_map_status(p_zernio text, p_current text)
returns text
language sql
immutable
as $$
  select case
    -- scheduledFor ile gonderdigimiz post taslak donmemeli; donerse kuyrukta goster.
    when p_zernio = 'draft' then 'scheduled'
    when p_zernio in ('scheduled', 'publishing', 'published', 'partial', 'failed', 'cancelled') then p_zernio
    else p_current
  end
$$;

-- Zernio post.platforms[] -> [{platform, account_id, status, url, error}].
-- accountId string ya da populate edilmis {_id} olabilir. Bos gelirse mevcut kalir.
-- Time: O(k), k platform girdisi
create or replace function public.helm_social_platforms_from_zernio(p_post jsonb, p_current jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'platform', e ->> 'platform',
          'account_id', coalesce(e -> 'accountId' ->> '_id', e ->> 'accountId'),
          'status', e ->> 'status',
          'url', nullif(e ->> 'platformPostUrl', ''),
          'error', left(nullif(e ->> 'errorMessage', ''), 500)
        )
        order by ord
      )
      from jsonb_array_elements(
        case when jsonb_typeof(p_post -> 'platforms') = 'array' then p_post -> 'platforms' else '[]'::jsonb end
      ) with ordinality x(e, ord)
    ),
    p_current
  )
$$;

-- Tek bir Zernio post nesnesini social_posts satirina uygular (create yaniti ve
-- refresh ortak yolu). Degisiklik yoksa yazmaz: updated_at gurultusu ve WAL yok.
-- Aktif olmayan bir satiri aktife cevirmek, ayni kutuphane ogesinde baska aktif
-- post varsa atlanir (unique partial index tum collect'i dusurmesin).
-- Time: O(k) + birkac PK/unique index erisimi
create or replace function public.helm_social_apply_zernio_post(p_post_id uuid, p_post jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_cur public.social_posts;
  v_status text;
  v_platforms jsonb;
  v_error text;
begin
  select * into v_cur from public.social_posts where id = p_post_id for update;
  if not found or v_cur.status = 'cancelled' then return; end if;

  v_status := public.helm_social_map_status(p_post ->> 'status', v_cur.status);
  v_platforms := public.helm_social_platforms_from_zernio(p_post, v_cur.platforms);
  v_error := case
    when v_status in ('failed', 'partial') then (
      select left(string_agg((e ->> 'platform') || ': ' || (e ->> 'error'), ' | '), 500)
      from jsonb_array_elements(v_platforms) e
      where e ->> 'error' is not null
    )
  end;

  if v_status = any (public.helm_social_active_statuses())
     and not (v_cur.status = any (public.helm_social_active_statuses()))
     and v_cur.library_id is not null
     and exists (
       select 1 from public.social_posts o
       where o.library_id = v_cur.library_id
         and o.id <> v_cur.id
         and o.status = any (public.helm_social_active_statuses())
     ) then
    return;
  end if;

  update public.social_posts s set
    zernio_post_id = coalesce(p_post ->> '_id', s.zernio_post_id),
    status = v_status,
    scheduled_for = coalesce((p_post ->> 'scheduledFor')::timestamptz, s.scheduled_for),
    published_at = coalesce((p_post ->> 'publishedAt')::timestamptz, s.published_at),
    platforms = v_platforms,
    error = v_error
  where s.id = p_post_id
    and (s.zernio_post_id, s.status, s.scheduled_for, s.published_at, s.platforms, s.error)
        is distinct from (
          coalesce(p_post ->> '_id', s.zernio_post_id),
          v_status,
          coalesce((p_post ->> 'scheduledFor')::timestamptz, s.scheduled_for),
          coalesce((p_post ->> 'publishedAt')::timestamptz, s.published_at),
          v_platforms,
          v_error
        );
end;
$$;

-- Her platform icin projenin aktif hesabini secer: [{platform, account_id}].
-- Birden fazla varsa en son senkronlanan. Eksik platform -> hata.
-- Time: O(p log a) - (project_id) index'i, p <= 2
create or replace function public.helm_social_pick_targets(p_project_id uuid, p_platforms text[])
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_targets jsonb;
  v_missing text;
begin
  select
    jsonb_agg(jsonb_build_object('platform', p.platform, 'account_id', a.id) order by p.ord),
    string_agg(p.platform, ', ') filter (where a.id is null)
  into v_targets, v_missing
  from unnest(p_platforms) with ordinality p(platform, ord)
  left join lateral (
    select sa.id
    from public.social_accounts sa
    where sa.project_id = p_project_id
      and sa.platform = p.platform
      and sa.is_active
      and not sa.needs_reconnection
    order by sa.synced_at desc
    limit 1
  ) a on true;

  if v_missing is not null then
    raise exception 'helm: projede aktif hesap yok: %', v_missing using errcode = 'P0002';
  end if;
  return v_targets;
end;
$$;

-- POST /v1/posts govdesi. Saf: tum girdiler parametre.
-- privacyLevel PUBLIC_TO_EVERYONE: bagli TikTok hesabinin creator-info yaniti
-- bunu donduruyor; TikTok for Business ile bagli hesaplar videoyu zaten yalnizca
-- public yayinlar. Time: O(p)
create or replace function public.helm_social_post_payload(
  p_lib public.social_library,
  p_post_id uuid,
  p_scheduled_for timestamptz,
  p_targets jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'mediaItems', jsonb_build_array(jsonb_build_object('type', 'video', 'url', p_lib.video_url)),
    'scheduledFor', to_char(p_scheduled_for at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'timezone', 'Europe/Istanbul',
    'metadata', jsonb_build_object('helm_post_id', p_post_id),
    'platforms', (
      select jsonb_agg(
        case t ->> 'platform'
          when 'tiktok' then jsonb_strip_nulls(jsonb_build_object(
            'platform', 'tiktok',
            'accountId', t ->> 'account_id',
            'customContent', nullif(p_lib.tiktok_caption, ''),
            'platformSpecificData', jsonb_build_object(
              'privacyLevel', 'PUBLIC_TO_EVERYONE',
              'allowComment', true,
              'allowDuet', true,
              'allowStitch', true,
              'contentPreviewConfirmed', true,
              'expressConsentGiven', true,
              'videoCoverImageUrl', nullif(p_lib.thumbnail_url, '')
            )
          ))
          when 'instagram' then jsonb_strip_nulls(jsonb_build_object(
            'platform', 'instagram',
            'accountId', t ->> 'account_id',
            'customContent', nullif(p_lib.instagram_caption, ''),
            'platformSpecificData', jsonb_build_object(
              'shareToFeed', true,
              'firstComment', nullif(p_lib.pinned_comment, '')
            )
          ))
        end
        order by ord
      )
      from jsonb_array_elements(p_targets) with ordinality x(t, ord)
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- Istemci RPC'leri
-- ---------------------------------------------------------------------------

-- Tek kutuphane ogesini planlar. Time: O(p) + sabit sayida index erisimi.
create or replace function public.helm_social_publish(
  p_library_id uuid,
  p_platforms text[],
  p_scheduled_for timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_platforms text[];
  v_when timestamptz := coalesce(p_scheduled_for, now() + interval '2 minutes');
  v_lib public.social_library;
  v_targets jsonb;
  v_post_id uuid := gen_random_uuid();
  v_request_id bigint;
begin
  perform public.helm_social_assert_caller();
  v_platforms := public.helm_social_normalize_platforms(p_platforms);

  if v_when < now() + interval '1 minute' then
    raise exception 'helm: yayin zamani en az 1 dakika sonrasi olmali' using errcode = '22023';
  end if;

  -- FOR UPDATE: ayni oge icin eszamanli iki publish sirayla kosar; ikincisi
  -- aktif postu gorur ve anlamli hatayla doner (index hatasi yerine).
  select * into v_lib from public.social_library where id = p_library_id for update;
  if not found then
    raise exception 'helm: kutuphane ogesi bulunamadi' using errcode = 'P0002';
  end if;
  if v_lib.archived then
    raise exception 'helm: kutuphane ogesi arsivlenmis' using errcode = '22023';
  end if;
  if coalesce(v_lib.video_url, '') = '' then
    raise exception 'helm: kutuphane ogesinin videosu yuklenmemis' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.social_posts
    where library_id = p_library_id
      and status = any (public.helm_social_active_statuses())
  ) then
    raise exception 'helm: bu oge zaten planli ya da yayinda' using errcode = '23505';
  end if;

  v_targets := public.helm_social_pick_targets(v_lib.project_id, v_platforms);

  insert into public.social_posts (id, project_id, library_id, status, scheduled_for, platforms)
  select
    v_post_id, v_lib.project_id, v_lib.id, 'sending', v_when,
    jsonb_agg(jsonb_build_object(
      'platform', t ->> 'platform', 'account_id', t ->> 'account_id',
      'status', 'pending', 'url', null, 'error', null
    ) order by ord)
  from jsonb_array_elements(v_targets) with ordinality x(t, ord);

  -- X-Request-Id = post id: Zernio ayni kimlikli tekrari 5 dk icinde yeni post
  -- acmadan orijinaliyle yanitlar. 20 sn: planli post olusturma senkron yukleme
  -- yapmaz, varsayilan 5 sn soguk baslangicta yetmeyebiliyor.
  v_request_id := net.http_post(
    url := public.helm_social_zernio_url('/posts'),
    body := public.helm_social_post_payload(v_lib, v_post_id, v_when, v_targets),
    headers := public.helm_social_zernio_headers() || jsonb_build_object('X-Request-Id', v_post_id::text),
    timeout_milliseconds := 20000
  );

  insert into public.social_net_requests (request_id, kind, post_id)
  values (v_request_id, 'create', v_post_id);

  return v_post_id;
end;
$$;

-- Aktif postu olmayan ogeleri gunde bir, 20:00 Europe/Istanbul'a dizer.
-- Ilk gun: projedeki aktif postlarin en son planli gununden sonraki gun, en
-- erken yarin. Videosu yuklenmemis/arsivli ogeler atlanir (birinin eksigi
-- tum planlamayi dusurmesin).
-- Time: O(n log n) siralama + n * publish; n kutuphane ogesi (~21).
create or replace function public.helm_social_schedule_all(
  p_project_id uuid,
  p_platforms text[] default '{tiktok,instagram}'
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  c_tz constant text := 'Europe/Istanbul';
  v_today date := (now() at time zone c_tz)::date;
  v_last date;
  v_day date;
  v_item record;
  v_count integer := 0;
begin
  perform public.helm_social_assert_caller();
  perform public.helm_social_normalize_platforms(p_platforms);

  select max((scheduled_for at time zone c_tz)::date) into v_last
  from public.social_posts
  where project_id = p_project_id
    and status = any (public.helm_social_active_statuses());

  v_day := greatest(coalesce(v_last + 1, v_today + 1), v_today + 1);

  for v_item in
    select l.id
    from public.social_library l
    where l.project_id = p_project_id
      and not l.archived
      and coalesce(l.video_url, '') <> ''
      and not exists (
        select 1 from public.social_posts p
        where p.library_id = l.id
          and p.status = any (public.helm_social_active_statuses())
      )
    order by l.sort_order, l.code
  loop
    perform public.helm_social_publish(v_item.id, p_platforms, (v_day + time '20:00') at time zone c_tz);
    v_day := v_day + 1;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Yalnizca Zernio'da planli (id'si bilinen) post iptal edilir. Time: O(1)
create or replace function public.helm_social_cancel(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_post public.social_posts;
  v_request_id bigint;
begin
  perform public.helm_social_assert_caller();

  select * into v_post from public.social_posts where id = p_post_id for update;
  if not found then
    raise exception 'helm: post bulunamadi' using errcode = 'P0002';
  end if;
  if v_post.status <> 'scheduled' or v_post.zernio_post_id is null then
    raise exception 'helm: yalnizca planli post iptal edilebilir' using errcode = '22023';
  end if;
  -- URL yoluna gomuluyor; Zernio id'si 24 hex, baska bir sey yol enjeksiyonu olur.
  if v_post.zernio_post_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'helm: gecersiz zernio post id' using errcode = '22023';
  end if;

  v_request_id := net.http_delete(
    url := public.helm_social_zernio_url('/posts/' || v_post.zernio_post_id),
    headers := public.helm_social_zernio_headers(),
    timeout_milliseconds := 20000
  );

  insert into public.social_net_requests (request_id, kind, post_id)
  values (v_request_id, 'cancel', p_post_id);
end;
$$;

-- Zernio post listesini cekme istegini kuyruga atar. En yeni 100 post: aktif
-- kuyruk (en fazla birkac on) rahat sigar. Time: O(1)
create or replace function public.helm_social_refresh()
returns void
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_request_id bigint;
begin
  perform public.helm_social_assert_caller();

  v_request_id := net.http_get(
    url := public.helm_social_zernio_url('/posts'),
    params := jsonb_build_object('limit', '100', 'sortBy', 'created-desc'),
    headers := public.helm_social_zernio_headers(),
    timeout_milliseconds := 20000
  );

  insert into public.social_net_requests (request_id, kind, post_id)
  values (v_request_id, 'refresh', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Toplayici (ic)
-- ---------------------------------------------------------------------------

-- create yaniti.
--  2xx       -> post (ya da idempotent tekrarda existingPost) uygulanir.
--  4xx       -> Zernio postu olusturmadi: failed + kirpilmis hata.
--  5xx / yanitsiz / zaman asimi -> belirsiz: Zernio olusturmus olabilir.
--               'sending' kalir; refresh metadata.helm_post_id ile uzlastirir,
--               30 dk icinde bulunamazsa failed yapar.
create or replace function public.helm_social_collect_create(
  p_post_id uuid,
  p_status_code integer,
  p_content text,
  p_timed_out boolean,
  p_error_msg text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_body jsonb;
  v_post jsonb;
begin
  if coalesce(p_timed_out, false) or p_status_code is null or p_status_code >= 500 then
    update public.social_posts
    set error = left(
      case
        when p_status_code is null then 'Zernio yaniti alinamadi (' || coalesce(p_error_msg, 'zaman asimi') || ')'
        else public.helm_social_error_text(p_status_code, p_content)
      end || '; durum yenilemede netlesecek', 500)
    where id = p_post_id and status = 'sending';
    return;
  end if;

  if p_status_code between 200 and 299 then
    v_body := public.helm_social_try_jsonb(p_content);
    v_post := coalesce(v_body -> 'post', v_body -> 'existingPost');
    if v_post is null or v_post ->> '_id' is null then
      update public.social_posts
      set status = 'failed', error = left('Zernio beklenmeyen yanit: ' || coalesce(p_content, ''), 500)
      where id = p_post_id and status = 'sending';
      return;
    end if;
    perform public.helm_social_apply_zernio_post(p_post_id, v_post);
    return;
  end if;

  update public.social_posts
  set status = 'failed',
      error = public.helm_social_error_text(p_status_code, p_content),
      platforms = (
        select coalesce(jsonb_agg(e || jsonb_build_object('status', 'failed')), '[]'::jsonb)
        from jsonb_array_elements(platforms) e
      )
  where id = p_post_id and status = 'sending';
end;
$$;

-- cancel yaniti. 404 = Zernio'da zaten yok (onceki iptal zaman asimina ugramis
-- olabilir) -> iptal edilmis say. Diger hatalar durumu degistirmez.
create or replace function public.helm_social_collect_cancel(
  p_post_id uuid,
  p_status_code integer,
  p_content text,
  p_error_msg text
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_status_code between 200 and 299 or p_status_code = 404 then
    update public.social_posts
    set status = 'cancelled', error = null,
        platforms = (
          select coalesce(jsonb_agg(e || jsonb_build_object('status', 'cancelled')), '[]'::jsonb)
          from jsonb_array_elements(platforms) e
        )
    where id = p_post_id and status = 'scheduled';
    return;
  end if;

  update public.social_posts
  set error = left('Iptal basarisiz: ' || case
      when p_status_code is null then 'Zernio yaniti alinamadi (' || coalesce(p_error_msg, 'zaman asimi') || ')'
      else public.helm_social_error_text(p_status_code, p_content)
    end, 500)
  where id = p_post_id;
end;
$$;

-- refresh yaniti. Her Zernio postu once zernio_post_id (unique index), yoksa
-- metadata.helm_post_id ile yalnizca hala 'sending' olan satira eslenir.
-- Sonra: 30 dakikadan eski, eslesmemis 'sending' satirlar failed olur - istek
-- Zernio'ya hic ulasmadiysa oge sonsuza kadar "aktif" kilitli kalmasin.
-- Time: O(P) index erisimi, P <= 100
create or replace function public.helm_social_collect_refresh(p_status_code integer, p_content text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_posts jsonb;
  v_post jsonb;
  v_id uuid;
  v_helm_id text;
begin
  if p_status_code is null or p_status_code not between 200 and 299 then
    return;
  end if;
  v_posts := public.helm_social_try_jsonb(p_content) -> 'posts';
  if jsonb_typeof(v_posts) is distinct from 'array' then
    return;
  end if;

  for v_post in select e from jsonb_array_elements(v_posts) e loop
    v_id := null;
    select id into v_id from public.social_posts where zernio_post_id = v_post ->> '_id';

    if v_id is null then
      v_helm_id := v_post -> 'metadata' ->> 'helm_post_id';
      if v_helm_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select id into v_id from public.social_posts
        where id = v_helm_id::uuid and zernio_post_id is null and status = 'sending';
      end if;
    end if;

    if v_id is not null then
      perform public.helm_social_apply_zernio_post(v_id, v_post);
    end if;
  end loop;

  update public.social_posts
  set status = 'failed',
      error = left(coalesce(error || ' | ', '') || 'Zernio''da bulunamadi', 500)
  where status = 'sending'
    and zernio_post_id is null
    and created_at < now() - interval '30 minutes';
end;
$$;

-- Tamamlanan pg_net yanitlarini isler ve istek satirini siler. Yaniti hic
-- gelmeyen (pg_net TTL'i ile silinmis) istekler 1 gun sonra temizlenir.
-- SKIP LOCKED: cron ile elle cagri ust uste binerse ayni yanit iki kez islenmez.
-- Donus: islenen yanit sayisi. Time: O(R) PK join, R bekleyen istek.
create or replace function public.helm_social_collect()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  r record;
  v_count integer := 0;
begin
  perform public.helm_social_assert_caller();

  for r in
    select q.request_id, q.kind, q.post_id,
           resp.status_code, resp.content, resp.timed_out, resp.error_msg
    from public.social_net_requests q
    join net._http_response resp on resp.id = q.request_id
    order by q.request_id
    for update of q skip locked
  loop
    case r.kind
      when 'create' then
        perform public.helm_social_collect_create(r.post_id, r.status_code, r.content, r.timed_out, r.error_msg);
      when 'cancel' then
        perform public.helm_social_collect_cancel(r.post_id, r.status_code, r.content, r.error_msg);
      when 'refresh' then
        perform public.helm_social_collect_refresh(r.status_code, r.content);
    end case;

    delete from public.social_net_requests where request_id = r.request_id;
    v_count := v_count + 1;
  end loop;

  delete from public.social_net_requests where created_at < now() - interval '1 day';
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------

-- Supabase varsayilan ayricaliklari yeni fonksiyonlari anon/authenticated'a
-- acar. helm_social_zernio_headers anahtari dondurdugu icin bu kapanis sart.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'helm\_social\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end;
$$;

grant execute on function public.helm_social_publish(uuid, text[], timestamptz) to authenticated, service_role;
grant execute on function public.helm_social_schedule_all(uuid, text[]) to authenticated, service_role;
grant execute on function public.helm_social_cancel(uuid) to authenticated, service_role;
grant execute on function public.helm_social_refresh() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cron
-- ---------------------------------------------------------------------------

-- Bos kuyrukta collect tek bir bos PK join; her dakika kosmasi ucretsiz.
select cron.schedule(
  'helm-social-collect',
  '* * * * *',
  $job$ select public.helm_social_collect(); $job$
);

-- Zernio'ya yalnizca bekleyen ya da son 1 gunde yayinlanmis post varken gidilir
-- (TikTok post URL'si yayindan sonra geliyor). Bos gunde 288 gereksiz istek yok.
select cron.schedule(
  'helm-social-refresh',
  '*/5 * * * *',
  $job$
  select public.helm_social_refresh()
  where exists (
    select 1 from public.social_posts
    where status in ('sending', 'scheduled', 'publishing')
       or (status in ('published', 'partial') and published_at > now() - interval '1 day')
  );
  $job$
);

comment on table public.social_library is
  'Yayina hazir sosyal videolar (kutuphane). Icerik private manifest''ten import edilir.';
comment on table public.social_posts is
  'Zernio yayin kuyrugu. Yazma yalnizca helm_social_* RPC''leri ve toplayici.';
comment on table public.social_net_requests is
  'pg_net istek takibi (create/cancel/refresh). Istemciye kapali.';

-- Kaldirmak icin:
--   select cron.unschedule('helm-social-collect');
--   select cron.unschedule('helm-social-refresh');
