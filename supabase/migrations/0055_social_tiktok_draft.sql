-- 0055 - TikTok ayarlarini belgelenmis tiktokSettings nesnesine tasir ve
-- "TikTok'a taslak gonder" (Creator Inbox) secenegini ekler.
--
-- NEDEN TASLAK: Zernio'nun TikTok dogrudan paylasimi, TikTok'un uygulama basina
-- 24 saatlik aktif hesap kotasina bagli (reached_active_user_cap). Kota tum
-- Zernio musterileri arasinda ortak; dolunca post failed olur ve Zernio tekrar
-- denemez. Taslaklar bu kotadan muaf: video creator'in TikTok gelen kutusuna
-- duser, aciklama/kapak/Paylas adimini creator uygulamada bitirir.
-- Kaynak: docs.zernio.com/platforms/tiktok ("Direct posting at capacity", "Drafts").
--
-- NEDEN tiktok_draft KOLONU: Zernio taslagi da status=published ile bitirir
-- (platformPostUrl null, platformSpecificData.isDraft true). Kolon olmadan Helm
-- hic yayinlanmamis bir videoya "Yayinda" derdi.
--
-- NEDEN tiktokSettings: 0053 TikTok alanlarini platforms[].platformSpecificData
-- icine camelCase yaziyordu. Dokuman TikTok ayarlarinin istegin en ust
-- seviyesindeki tiktokSettings nesnesinde oldugunu soyluyor; Zernio bu nesneyi
-- her TikTok girdisine birlestirir. Instagram yolu degismedi.
--
-- Uygulama sirasi: once bu migration, sonra istemciler (istemci tiktok_draft
-- kolonunu okur ve RPC'yi p_tiktok_draft ile cagirir).

alter table public.social_posts
  add column if not exists tiktok_draft boolean not null default false;

comment on column public.social_posts.tiktok_draft is
  'TikTok girdisi Creator Inbox taslagi olarak gonderildi; Zernio published dese de video public degil.';

-- ---------------------------------------------------------------------------
-- Payload
-- ---------------------------------------------------------------------------

-- Arguman listesi degisiyor: create or replace yeni bir overload acar, eskisini
-- birakirdi. Once dusur.
drop function if exists public.helm_social_post_payload(public.social_library, uuid, timestamptz, jsonb);

-- POST /v1/posts govdesi. Saf: tum girdiler parametre.
-- privacy_level PUBLIC_TO_EVERYONE: TikTok for Business ile bagli hesaplar
-- videoyu yalnizca public yayinlar; dokumana gore taslakta da zorunlu alan.
-- Time: O(p), p <= 2
create function public.helm_social_post_payload(
  p_lib public.social_library,
  p_post_id uuid,
  p_scheduled_for timestamptz,
  p_targets jsonb,
  p_tiktok_draft boolean
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
            'customContent', nullif(p_lib.tiktok_caption, '')
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
  || case
    when jsonb_path_exists(p_targets, '$[*] ? (@.platform == "tiktok")') then jsonb_build_object(
      'tiktokSettings', jsonb_strip_nulls(jsonb_build_object(
        'privacy_level', 'PUBLIC_TO_EVERYONE',
        'allow_comment', true,
        'allow_duet', true,
        'allow_stitch', true,
        'content_preview_confirmed', true,
        'express_consent_given', true,
        'video_cover_image_url', nullif(p_lib.thumbnail_url, ''),
        'draft', p_tiktok_draft
      ))
    )
    else '{}'::jsonb
  end
$$;

-- ---------------------------------------------------------------------------
-- Yayin RPC'si
-- ---------------------------------------------------------------------------

drop function if exists public.helm_social_publish(uuid, text[], timestamptz);

-- 0053 govdesiyle ayni; fark: p_tiktok_draft (varsayilan false, boylece
-- helm_social_schedule_all'in 3 argumanli cagrisi degismeden calisir).
-- Time: O(p) + sabit sayida index erisimi.
create function public.helm_social_publish(
  p_library_id uuid,
  p_platforms text[],
  p_scheduled_for timestamptz default null,
  p_tiktok_draft boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_platforms text[];
  v_when timestamptz := coalesce(p_scheduled_for, now() + interval '2 minutes');
  v_draft boolean := coalesce(p_tiktok_draft, false);
  v_lib public.social_library;
  v_targets jsonb;
  v_post_id uuid := gen_random_uuid();
  v_request_id bigint;
begin
  perform public.helm_social_assert_caller();
  v_platforms := public.helm_social_normalize_platforms(p_platforms);

  if v_draft and not ('tiktok' = any (v_platforms)) then
    raise exception 'helm: taslak yalnizca tiktok icin gonderilebilir' using errcode = '22023';
  end if;

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

  insert into public.social_posts (id, project_id, library_id, status, scheduled_for, platforms, tiktok_draft)
  select
    v_post_id, v_lib.project_id, v_lib.id, 'sending', v_when,
    jsonb_agg(jsonb_build_object(
      'platform', t ->> 'platform', 'account_id', t ->> 'account_id',
      'status', 'pending', 'url', null, 'error', null
    ) order by ord),
    v_draft
  from jsonb_array_elements(v_targets) with ordinality x(t, ord);

  -- X-Request-Id = post id: Zernio ayni kimlikli tekrari 5 dk icinde yeni post
  -- acmadan orijinaliyle yanitlar.
  v_request_id := net.http_post(
    url := public.helm_social_zernio_url('/posts'),
    body := public.helm_social_post_payload(v_lib, v_post_id, v_when, v_targets, v_draft),
    headers := public.helm_social_zernio_headers() || jsonb_build_object('X-Request-Id', v_post_id::text),
    timeout_milliseconds := 20000
  );

  insert into public.social_net_requests (request_id, kind, post_id)
  values (v_request_id, 'create', v_post_id);

  return v_post_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------

-- Yeni fonksiyonlar Supabase varsayilan ayricaliklariyla herkese acik dogar.
revoke all on function public.helm_social_post_payload(public.social_library, uuid, timestamptz, jsonb, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.helm_social_publish(uuid, text[], timestamptz, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.helm_social_publish(uuid, text[], timestamptz, boolean)
  to authenticated, service_role;

-- PostgREST yeni RPC imzasini hemen gorsun.
notify pgrst, 'reload schema';
