# Zernio sosyal medya entegrasyonu - tasarım

**Durum:** onaylandı, uygulama planı bekliyor
**Kapsam:** tam paket - analitik + yayın + inbox. Üç alt proje, sırayla.
**Kaynak doğrulama:** Zernio OpenAPI 1.0.4 (`https://zernio.com/openapi.json`),
2026-09-14'te canlı key ile teyit edildi: 1 profil, 2 hesap (Instagram,
TikTok), 8 yayınlanmış post, boş inbox.

## Sorun

Helm bugün gelir, kullanıcı, crash ve review'u tek yerde topluyor. Sosyal
medya hiç yok; `apps/web/src/lib/modules.ts:112` içinde `social` modülü
"coming soon" olarak duruyor. Can'ın hesapları Zernio'da bağlı; Helm'den
takipçi/etkileşim görmek, post planlamak ve DM/yorumlara cevap vermek istiyor.

## Karar

**Hibrit:** Helm'in ürettiği veya küçük olan veri aynalanır (hesaplar, postlar,
inbox olay kayıtları, günlük metrikler); konuşma içeriği canlı proxy ile
okunur. Reddedilen alternatifler:

- *Canlı proxy (her şey):* rozet, KPI geçmişi ve push için her seferinde
  Zernio'ya sorulur; Zernio yavaşsa ekran yavaş; `metrics` dışına çıkılır.
- *Tam ayna:* mesaj ekleri süreli URL, düzenleme/silme/okundu olayları,
  sayfalama - Zernio zaten saklıyor, kopyası bakım yükü.

Zernio "profile" kavramı Helm "proje"sine eşlenir. Bağlantı, diğer
sağlayıcılar gibi proje başına bir `project_integrations` satırıdır.

## Zernio sözleşmesi (spec'ten)

- Base `https://zernio.com/api/v1`, `Authorization: Bearer sk_…` (64 hex).
- `GET /v1/profiles` → `profiles[]{_id,name,isDefault,accountUsernames[]}`
- `GET /v1/accounts` → `accounts[]{_id,platform,profileId,username,displayName,
  profilePicture,profileUrl,isActive,needsReconnection,followersCount,enabled}`
- `GET /v1/analytics?profileId&fromDate&toDate&page&limit` → post bazlı,
  kümülatif: `posts[]{_id,publishedAt,status,analytics{impressions,reach,likes,
  comments,shares,saves,clicks,views,engagementRate},platformAnalytics[]}`
- `GET /v1/analytics/delta?cursor` → değişen snapshot'lar (v2 için).
- `POST /v1/posts` (header `X-Request-Id` idempotent) body: `content,
  mediaItems[]{type,url,altText}, platforms[]{platform,accountId,customContent,
  customMedia,scheduledFor}, scheduledFor | publishNow | isDraft, timezone`.
  Yanıt `post{_id,status,platforms[]{status,platformPostUrl,errorMessage,
  errorCategory}}`. Durumlar: draft/scheduled/publishing/published/partial/
  failed/cancelled.
- `GET /v1/posts?profileId&status&page&limit`, `DELETE /v1/posts/{id}`.
- `POST /v1/media/presign {filename,contentType,size}` → `{uploadUrl,publicUrl}`;
  dosya `uploadUrl`'e PUT edilir (5 GB, 1 saat).
- `GET /v1/inbox/conversations?profileId&accountId&cursor&limit` →
  `data[]{id,platform,accountId,accountUsername,participantName,
  participantPicture,lastMessage,updatedTime,unreadCount,url}`
- `GET /v1/inbox/conversations/{id}/messages?accountId&cursor` →
  `messages[]{id,message,senderName,direction,createdAt,attachments[]}`
- `POST /v1/inbox/conversations/{id}/messages {accountId,message}`
  (header `Idempotency-Key`); `POST …/{id}/read`.
- Webhook: `POST /v1/webhooks/settings {name,url,secret,events[]}`;
  imza `X-Zernio-Signature` HMAC-SHA256, olay id `X-Zernio-Event-Id`.
  Kullanılan olaylar: `post.scheduled|published|failed|partial|cancelled`,
  `post.platform.published|failed`, `message.received`, `comment.received`,
  `account.connected|disconnected`, `analytics.synced`, `webhook.test`.

**Varsayım:** imza ham gövde üstünde hex HMAC. Uygulamada
`POST /v1/webhooks/test` ile doğrulanır; tutmazsa `X-Zernio-Event-Id +
timestamp + body` (Svix kalıbı) denenir.

## Veri modeli - `supabase/migrations/0051_zernio.sql`

```
project_integrations.provider check += 'zernio'
  config: { api_key (gizli), profile_id? }   -- boşsa isDefault profil

social_accounts
  id text pk (Zernio account _id), project_id → properties, platform,
  username, display_name, avatar_url, profile_url, followers_count int,
  is_active bool, needs_reconnection bool, synced_at, created_at

social_account_daily
  account_id → social_accounts, date, followers int, impressions int,
  reach int, engagements int            pk (account_id, date)

social_posts
  id text pk (Zernio post _id), project_id, content text, media jsonb,
  platforms jsonb [{platform, account_id, status, url, error, error_category}],
  status text, scheduled_for timestamptz, published_at, created_by text
  (actor email), created_at, updated_at

social_inbox_events
  id text pk (Zernio event id), project_id, account_id, kind text
  (message|comment), conversation_id text, participant_name text,
  preview text, received_at, read_at         index (project_id, read_at)
```

RLS: repodaki mevcut kalıp - `authenticated` okur, yazma yalnızca
`service_role` (`0036_revenue_events.sql` ile aynı). Webhook olayını projeye
bağlayan köprü `social_accounts.project_id`'dir; RevenueCat'teki "tek
entegrasyonu seç" kısayolu kullanılmaz.

`metrics` satırları (`source = 'zernio'`, günlük, upsert):
`social_followers` (anlık toplam), `social_impressions`, `social_reach`,
`social_engagements` (likes+comments+shares+saves), `social_posts_published`.
Günlük seri kuralı: post metrikleri **yayın gününe** yazılır (kümülatif
değerin gün gün farkı v1'de tutulmaz). Takipçi gece anlık okunur.
`MONEY_METRICS`'e girmez, sayaçtır.

## Backend

### `helm-ingest/connectors/zernio.ts`
Mevcut `Connector` sözleşmesi. Adımlar: profil çöz → hesapları çek ve
`social_accounts`'ı upsert et → son 90 günün `GET /v1/analytics` sayfalarını
gez → yayın gününe göre topla → `MetricPoint[]` döndür; hesap × gün kırılımını
`social_account_daily`'ye yaz. Kayıt: `helm-ingest`, `helm-test`, `helm-verify`
üçüne de eklenir (son ikisi bugün App Store Connect ve Google Play için de
eksik; aynı düzeltmede tamamlanır).

### `helm-social` (yeni, kullanıcı JWT)
`helm-review-reply` kalıbı: service-role client, aktör caller JWT'den,
60 sn'de 10 yazma sınırı, her yazma `audit_log`'a. Body `{ project_id, action,
params }`. Aksiyonlar:

| action | Zernio | Helm yan etkisi |
|---|---|---|
| `accounts.sync` | GET /accounts | `social_accounts` upsert |
| `webhook.ensure` | POST /webhooks/settings | - (entegrasyon kaydında çağrılır) |
| `posts.create` | POST /posts (X-Request-Id) | `social_posts` insert |
| `posts.cancel` | DELETE /posts/{id} | status=cancelled |
| `posts.sync` | GET /posts | `social_posts` upsert (webhook kaçarsa) |
| `media.presign` | POST /media/presign | - |
| `inbox.conversations` | GET /inbox/conversations | - (proxy) |
| `inbox.messages` | GET …/messages | - (proxy) |
| `inbox.send` | POST …/messages (Idempotency-Key) | audit_log |
| `inbox.read` | POST …/read | `social_inbox_events.read_at` |

Zernio hata gövdesi `{error,type,code}` olduğu gibi `problem+json` benzeri
döner; 429'da `retryAfter` iletilir.

### `helm-zernio-webhook` (yeni)
Ham gövde okunur, `X-Zernio-Signature` doğrulanır, secret env
`ZERNIO_WEBHOOK_SECRET` (Resend kalıbı; env yoksa **reddedilir**, dev modu
yok). Olay id ile idempotent (`social_inbox_events.id`, post için
`updated_at` karşılaştırması). Eşleme:

- `post.*`, `post.platform.*` → `social_posts` durum/url/hata güncelle.
- `message.received`, `comment.received` → `social_inbox_events` insert +
  `helm_push_devices` üzerinden push (`data: {kind:"social", conversation_id,
  account_id}`).
- `account.disconnected` → `needs_reconnection = true` + push.
- `account.connected` → `accounts.sync`.
- `analytics.synced` → `helm-ingest` yalnızca zernio için tetiklenir.

`sendExpoPush` `helm-alert`'ten `_shared/expo-push.ts`'e taşınır; iki
fonksiyon aynı kodu kullanır.

### Cron
Yeni cron yok. Nightly `helm-ingest` connector'ı çalıştırır; post durumu ve
inbox webhook ile gelir.

```
Zernio ──webhook──▶ helm-zernio-webhook ──▶ social_posts / social_inbox_events ──▶ push
Zernio ◀──API────── helm-social ◀────────── web / mobil (post yaz, mesaj oku/yanıtla)
Zernio ◀──API────── helm-ingest (nightly) ─▶ metrics + social_accounts + social_account_daily
```

## Paylaşılan katman

- `packages/domain/src/integrations.ts`: `zernio` → `PROVIDERS`,
  `PROVIDER_LABEL` ("Zernio"), `PROVIDER_FIELDS` (`api_key` secret,
  `profile_id` optional).
- `packages/api/src/social.ts`: satır tipleri (`SocialAccount`, `SocialPost`,
  `SocialInboxEvent`, `SocialConversation`, `SocialMessage`), fetch'ler,
  `invokeSocial(client, action, params)`.
- `packages/queries/src/social.ts`: `socialKeys` + queryOptions
  (accounts, posts, inboxEvents, unreadCount, conversations, messages);
  `index.ts`'e export satırı.
- Web kopyaları: `apps/web/src/types/index.ts` (`ProviderName`,
  `PROVIDER_LABELS`), `integrations-panel/index.tsx` (`PROVIDER_FIELDS`),
  `lib/integrations.ts` (`PROVIDER_META`, kategori `communication`),
  `lib/modules.ts` (`comingSoon` kaldırılır, `SOURCE_TO_MODULE.zernio =
  "social"`), `data-coverage.ts` `EXPECTED_LAG.zernio`.
- **Borç, kapsam dışı:** web `@helm/domain`'i içe aktarmıyor; iki kopya liste
  elle tutuluyor. Bu işte ikisine de eklenir, birleştirme ayrı iş.

## Web arayüzü

`/social` sayfası (`apps/web/src/pages/social/`), Refine resource `social`,
sidebar "Sosyal" (`requires: "social"`). Üç sekme:

1. **Genel bakış** - KPI kartları (takipçi, impression, reach, engagement,
   yayınlanan post; 30 gün, önceki döneme göre delta), hesap tablosu (avatar,
   platform, takipçi, durum; `needs_reconnection` ise Zernio'ya "yeniden
   bağla" linki), hesap × gün çizgi grafiği.
2. **Yayın** - `social_posts` listesi (durum filtresi), composer dialog:
   metin, medya (presign → PUT, önizleme), hesap çoklu seçim, platform başına
   özel metin (isteğe bağlı), "şimdi" / tarih-saat + timezone. Platform başına
   hata `errorCategory` etiketiyle gösterilir. Planlıyı iptal.
3. **Inbox** - sol konuşma listesi (hesap filtresi, okunmamış rozeti), sağ
   mesaj paneli (ekler görüntülenir), altta yanıt kutusu. Açılınca
   `inbox.read`.

Entegrasyon paneli: Zernio kartı, "Test connection" (`helm-test` profil +
hesap sayısı döner), kayıt sonrası `webhook.ensure`.

## Mobil

Beş native sekme dolu; altıncı sekme eklenmez. `app/(cockpit)/social/` stack'i:

```
social/_layout.tsx   Stack, headerShown:false
social/index.tsx     KPI kartları + hesap listesi
social/posts.tsx     post listesi + composer'a giriş
social/compose.tsx   web ile birebir: metin, medya (expo-image-picker →
                     presign PUT), hesap seçimi, platform başına metin,
                     @expo/ui tarih seçici, şimdi/planla
social/inbox.tsx     konuşma listesi
social/[conversationId].tsx  mesajlar + yanıt kutusu
```

Giriş noktaları: Overview'e "Sosyal" karosu (takipçi + okunmamış), Ayarlar'a
satır, push'a dokununca doğrudan konuşma (`data.kind === "social"`,
`use-push-registration` yanına deep-link handler). Rozet: Health sekmesindeki
"teslim edilmemiş uyarı" kalıbı, okunmamış `social_inbox_events` sayısı.
Yeni bağımlılık: `expo-image-picker`. Kaynaklar ekranındaki form
`@helm/domain` alanlarını zaten okuduğu için Zernio kartı kendiliğinden gelir.

## Hata ve güvenlik

- API key client'a inmez; yalnızca edge function okur. Mobil `secretKeysSet`
  maskesi zaten var; web paneli ham config'i state'e alıyor (mevcut borç,
  değişmez).
- Webhook: imzasız/yanlış imza 401; env secret yoksa 500 ve log.
- `posts.create` Zernio 4xx → kullanıcıya Zernio mesajı; `social_posts`'a
  yazılmaz. 5xx → `X-Request-Id` ile tek retry.
- `inbox.send` metin 1..2000 karakter, `<script` reddi (review reply kalıbı).
- Connector 429 → `sync_runs` hata, mevcut retry.
- Loglarda key ve mesaj gövdesi yok; yalnızca id'ler.
- PII: `participant_name` ve `preview` `social_inbox_events`'te tutulur;
  30 gün sonra silinir (`0042_sync_runs_retention.sql` kalıbıyla cron).

## Test

- Connector: sahte `fetch` ile 2 sayfa analytics → yayın gününe toplama ve
  idempotent upsert (bun test, `helm-ingest` içinde mevcut kalıp varsa).
- Webhook: imza doğru/yanlış/eksik; aynı olay iki kez → tek satır.
- `helm-social`: aktör yok → 401; `posts.create` Zernio 400 → `social_posts`
  boş.
- UI: gerçek Zernio hesabıyla uçtan uca (mock veri yok).

## Alt projeler ve sıra

1. **Temel + analitik:** migration, provider kaydı (4 yer + 3 registry),
   connector, `helm-social` (`accounts.sync`, `webhook.ensure`), webhook
   (`account.*`, `analytics.synced`, `webhook.test`), web genel bakış sekmesi,
   mobil `social/index`, entegrasyon kartı, Overview karosu.
2. **Yayın:** `social_posts` yolu, `posts.*` + `media.presign`, composer web +
   mobil (`expo-image-picker`), `post.*` webhook olayları, iptal.
3. **Inbox:** `inbox.*` proxy, inbox web + mobil, `message/comment.received`
   → olay + push, rozet, deep-link, 30 gün temizlik.

Her alt proje kendi uygulama planını alır; 1 bitmeden 2 başlamaz.

## Açık noktalar

- Webhook imza formülü (bkz. varsayım). Alt proje 1'de netleşir.
- `followersCount` yalnızca analytics eklentisiyle geliyor (spec notu).
  Canlı hesapta değer var; eklentisiz hesapta `null` → metrik yazılmaz.
- Zernio rate limit değerleri spec'te yok; 429 gövdesindeki `retryAfter`
  esas alınır.
