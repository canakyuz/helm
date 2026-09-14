# Zernio alt proje 2: içerik kütüphanesi ve yayın - tasarım

**Durum:** onaylandı (2026-09-14), uygulanıyor
**Üst spec:** `2026-09-14-zernio-social-integration-design.md` (alt proje 2 "Yayın")

## Sorun

Sosyal sekmesi yalnızca üç KPI kartı ve hesap listesi gösteriyor. Paylaşım,
planlama ve kuyruk yok. Kullanıcı hazır reklam videolarını Helm'den paylaşmak
istiyor. Kartlar yer kaplıyor ve anlam taşımıyor.

## Kısıtlar

- Repo public: içerik, caption, hesap adı, id, proje ref'i, anahtar repoya girmez.
  Repoda yalnızca genel kod. İçerik private repodaki manifest'ten ve diskten gelir.
- Supabase Management API token'ı 401: edge function deploy edilemiyor.
  `supabase db push` (HELM_DB_URL) çalışıyor. pg_net 0.20, pg_cron, supabase_vault kurulu.
- Zernio anahtarı istemciye inmez.

## Karar

**Gönderimi veritabanı yapar.** İstemci security definer RPC çağırır; RPC Zernio
isteğini `pg_net` ile atar, anahtarı Vault'tan (`zernio_api_key`) okur. Yanıtlar
dakikalık cron ile toplanır. Webhook yerine 5 dakikada bir durum yenileme.

Reddedilen: edge function (deploy yok), istemcide anahtar (public paket).

**"Şimdi paylaş" = 2 dakika sonrası için planla.** pg_net isteği varsayılan 5 sn
zaman aşımına sahip; `publishNow` senkron video yüklemesi bunu aşar ve sonuç
belirsiz kalır. Planlı gönderi Zernio'da hemen döner.

## Veri modeli - `supabase/migrations/0053_social_publishing.sql`

```
social_library
  id uuid pk, project_id uuid → properties, campaign text, code text,
  sort_order int, hook text, voice text null,
  video_url text (Zernio presign publicUrl), thumbnail_url text null,
  duration_sec numeric null,
  tiktok_caption text, instagram_caption text, pinned_comment text null,
  archived bool default false, created_at, updated_at
  unique (project_id, code)

social_posts
  id uuid pk, project_id uuid, library_id uuid → social_library null,
  zernio_post_id text unique null,
  status text check in (sending, scheduled, publishing, published, partial, failed, cancelled),
  scheduled_for timestamptz null, published_at timestamptz null,
  platforms jsonb default '[]'   -- [{platform, account_id, status, url, error}]
  error text null, created_at, updated_at
  index (project_id, scheduled_for)

social_net_requests            -- pg_net istek takibi, istemciye kapalı
  request_id bigint pk, kind text check in (create, cancel, refresh),
  post_id uuid null, created_at
```

RLS: `social_library`, `social_posts` authenticated SELECT. Yazma yalnızca RPC
(security definer). `social_net_requests` RLS açık, politika yok.

## RPC sözleşmesi (istemcinin gördüğü tek yüzey)

| Fonksiyon | Dönüş | Davranış |
|---|---|---|
| `helm_social_publish(p_library_id uuid, p_platforms text[], p_scheduled_for timestamptz default null)` | `uuid` (post id) | platformlar ⊆ {tiktok, instagram}; null zaman → now()+2 dk; aynı kütüphane öğesinde aktif post (sending/scheduled/publishing/published/partial) varsa hata; hesapları aynı projenin aktif `social_accounts` satırlarından seçer |
| `helm_social_schedule_all(p_project_id uuid, p_platforms text[] default '{tiktok,instagram}')` | `int` | aktif postu olmayan öğeleri `sort_order` ile, en son planlı günden (en erken yarın) başlayarak her gün 20:00 Europe/Istanbul'a planlar |
| `helm_social_cancel(p_post_id uuid)` | `void` | yalnızca `scheduled`; Zernio'da siler, toplayıcı `cancelled` yapar |
| `helm_social_refresh()` | `void` | Zernio post listesini çekme isteği kuyruğa atar |

Hepsi `grant execute to authenticated`, `revoke from public, anon`.
İç: `helm_social_collect()` (cron `helm-social-collect` her dakika),
`helm-social-refresh` cron her 5 dakika.

## Zernio isteği

`POST /v1/posts`, `X-Request-Id: <social_posts.id>`:
`mediaItems:[{type:video, url:video_url}]`, `scheduledFor`, `timezone: Europe/Istanbul`,
`platforms:[{platform, accountId, customContent, platformSpecificData}]`.
TikTok: `privacyLevel` (creator info'dan doğrulanır), `allowComment/allowDuet/allowStitch: true`,
`contentPreviewConfirmed/expressConsentGiven: true`, `videoCoverImageUrl: thumbnail_url`.
Instagram: `shareToFeed: true`, `firstComment: pinned_comment` (varsa).
`metadata: {helm_post_id}`. İlk gerçek gönderiden önce TikTok `dryRun` ile doğrulanır.

## İçe aktarma

`scripts/social/import-library.ts` (repoda, veri içermez):
`bun run scripts/social/import-library.ts --manifest <json> --project <uuid> [--dry-run] [--force]`.
`ZERNIO_API_KEY` env, `HELM_DB_URL` `.env`'den. Her öğe için ffmpeg ile 0,6. saniye
kapak karesi (540×960 jpg), ffprobe süre, Zernio presign ile video + kapak yükleme,
`social_library` upsert. Yüklenmiş öğe `--force` olmadan atlanır.
Manifest private repoda: `empireinc-app/docs/marketing/mascot-production/comic-pilot-2026-09-07/publish-manifest.json`.
Kütüphane projesi hesapların projesiyle aynı (stüdyo); `campaign = empire-inc`.

## Arayüz

**Mobil sosyal sekmesi** - üç KPI kartı kalkar. Başlıkta tek satır özet
(takipçi · 30 gün impression). Native segment: **Kütüphane · Kuyruk · Hesaplar**.
- Kütüphane: satır başına 9:16 kapak, hook, kod · süre, durum (Hazır / 15 Eyl 20:00 / Yayında).
  Üstte "Hepsini planla" (onaylı). Satır → detay.
- Detay `(tabs)/social/[id].tsx`: büyük kapak (dokununca video tarayıcıda),
  TikTok ve Instagram metni (paylaş menüsüyle kopyala), sabit yorum, platform
  seçimi, "Şimdi paylaş" ve "Planla" (@expo/ui DateTimePicker).
- Kuyruk: planlı / yayında / hatalı, planlıda iptal, platform bağlantıları.
- Hesaplar: mevcut hesap satırları, kart yok.
Yeni native modül yok (OTA ile çıkar).

**Web `/social`** - aynı üç sekme; kütüphane tablosu, detay çekmecesi, kuyruk.

## Hata ve güvenlik

- RPC girdi doğrulaması; hatalar `raise exception` ile anlamlı Türkçe mesaj.
- Zernio hata gövdesi `social_posts.error`'a kırpılarak yazılır; anahtar asla.
- pg_net yanıtı 5 sn içinde gelmezse toplayıcı `failed` değil, refresh ile Zernio
  tarafındaki gerçek duruma bakar (X-Request-Id ile idempotent).
- Free tier 60 istek/dk: toplu planlama 21 istek, sınır altında.
