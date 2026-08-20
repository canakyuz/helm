# Reviews Entegrasyon Onarımı - Tasarım Spec'i

**Tarih:** 2026-05-26
**Issue:** WES-000
**Repo:** helm (web) + helm-mobile (UI tüketici)
**Scope:** A alt-projesi (4 alt-projeden ilki - B/C/D backlog'da)

## 1. Bağlam ve Sorun

Mevcut durum (kanıtlı gözlem):

- `helm-reviews/index.ts` Apple'ın **public iTunes RSS**'inden yorum çekiyor (`itunes.apple.com/.../rss/customerreviews`). Apple bu RSS'i resmi olarak desteklemiyor; eski/eksik veri dönebiliyor, `app_version` yok.
- **`helm-reviews` cron'u yok** - sadece web "Yenile" butonu ve mobil pull-to-refresh tetikliyor. Yorumlar passive.
- **Google Play yorum entegrasyonu yok** - `connectors/` altında play yok, reviews tablosuna Play'den hiç satır yazılmıyor.
- Mobile UI'da "Android" segmenti hazır (`app/(cockpit)/(reviews)/index.tsx:35-38`) ama veri kaynağı olmadığı için `playstoreCount` her zaman 0.
- Web sayfa başlığı `"Yorumlar (App Store)"` - Play eksikliği kabul edilmiş.
- Yorum yanıtlama yolu yok (Apple Customer Review Responses / Google reviews.reply kullanılmıyor).

Hedef: Web ve mobil için **tek backend** üzerinden hem App Store hem Google Play yorumlarını çekmek, otomatik tazelemek ve **yanıtlama** yapabilmek.

## 2. Karar Özeti

| Konu | Karar |
|---|---|
| App Store kaynağı | **Hibrit**: App Store Connect Customer Reviews API birincil; 401/5xx/timeout veya key eksikse iTunes RSS fallback |
| Google Play kaynağı | Resmî Google Play Developer Reviews API (service account JWT); 7g API sınırı kabul, cron sıklığıyla telafi |
| Cron sıklığı | 30 dakika (pg_cron) |
| Yanıtlama | Web + mobil ikisinde, **senkron** (toast ile hata), edit (re-submit) dahil, silme **scope dışı** |
| Yanıt edit mantığı | Aynı endpoint; Apple'da `PATCH`, Google'da `reply` idempotent (üzerine yazar) |
| Mevcut RSS row'ları | Korunur; `source_method='rss'` ile geriye uyumlu işaretlenir |

## 3. Mimari

```
┌────────────── pg_cron (her 30dk) ──────────────┐
│                                                 │
│   helm-reviews (Edge Function - refactor)       │
│   ├─ App Store: ASC Customer Reviews API        │
│   │   └─ fallback → iTunes RSS                  │
│   └─ Google Play: Reviews API (service account) │
│                                                 │
│   → upsert public.reviews                       │
│   → cron_runs row (ingest counts + duration)    │
└─────────────────────────────────────────────────┘

┌────────────── helm-review-reply (yeni Edge Function) ─────────────┐
│   Web/mobil "Yanıtla" → POST {review_id, body}                    │
│   → Apple ASC Customer Review Responses API  veya                 │
│   → Google Play androidpublisher.reviews.reply                    │
│   → reviews.developer_response + responded_at güncellenir         │
│   → audit_log entry (actor_email + action='review.reply')         │
│   → sync; fail → 4xx + JSON error → UI toast                      │
└───────────────────────────────────────────────────────────────────┘
```

Tüm secret'lar `project_integrations.config` (JSONB) içinde - yeni env var **yok**, mevcut pattern korunur (RLS service_role only).

## 4. Veri Modeli Değişiklikleri

### 4.1 `public.reviews` kolon eklemeleri

```sql
-- migration: 0024_reviews_v2.sql

alter table public.reviews
  add column if not exists territory          text,          -- iOS: 'us', Android: 'tr'
  add column if not exists app_version        text,          -- '1.0.3'
  add column if not exists developer_response text,
  add column if not exists responded_at       timestamptz,
  add column if not exists source_method      text;          -- 'asc' | 'rss' | 'play'

-- Mevcut row'ları işaretle (hepsi RSS kaynaklı)
update public.reviews
  set source_method = 'rss'
  where source_method is null and source = 'appstore';

-- source artık 'appstore' | 'playstore'; method ASC/RSS ayrımı için
comment on column public.reviews.source is
  '''appstore'' (iOS) veya ''playstore'' (Android)';
comment on column public.reviews.source_method is
  '''asc'' (App Store Connect API) | ''rss'' (iTunes RSS fallback) | ''play'' (Google Play API)';
```

**`external_id` formatı (yeni):**

| Kaynak | Format | Örnek |
|---|---|---|
| ASC API | `asc:{territory}:{reviewId}` | `asc:us:12345-abc-def` |
| RSS | `rss:{territory}:{guid}` | `rss:tr:tag:apple.com,...` |
| Play API | `play:{lang}:{reviewId}` | `play:tr:gp:AOqpTOH...` |

Mevcut RSS row'larının `external_id`'si **değiştirilmiyor** (kırılma riski yüksek, dedupe doğal olarak yeni çağrılarda normalize edilir; eski formattaki RSS row'ları "sahipsiz" kalmaz çünkü `source = 'appstore'` filter'ı UI'da geri uyumlu).

> **Trade-off:** Daha temiz bir migration mevcut row'ları yeniden formatlayabilirdi ama veri kaybı riski tutarsız `external_id` yorumlarından dolayı fazla. Yeni format yalnızca yeni satırlar için zorunlu.

### 4.2 `project_integrations` yeni provider

`provider = 'google_play_developer'`, config:

```json
{
  "service_account_json": "{...}",   // tüm JSON içerik string olarak
  "package_name": "com.example.app", // boşsa properties.google_play_id fallback
  "language_codes": ["en", "tr"]     // opsiyonel; default ["en", "tr"]
}
```

App Store Connect zaten `project_integrations` içinde (Sales için kullanılıyor) - Customer Reviews yetkisi key role'ünde mevcutsa otomatik çalışır. Yeni alan eklenmez; key tarafında scope kontrolü API'ye bırakılır.

### 4.3 `audit_log` action'ı

Yeni eylem türü: `review.reply`. Mevcut audit pattern (`helm-action`, commit e6b90a6) kullanılır. Payload: `{ review_id, source, territory, body_length }` (gövde tam metni audit'e yazılmaz - PII/uzunluk).

## 5. Edge Function: `helm-reviews` (refactor)

### 5.1 Akış

```
1. projects + project_integrations'ı tek seferde topla (Promise.all):
   - App Store target'ları: cfg.app_store_id (ASC) || projects.app_store_id (RSS)
   - Play target'ları: cfg.package_name || projects.google_play_id

2. Property başına PARALEL fetch (Promise.allSettled):
   - fetchAppStoreReviews(t): önce ASC → 401/5xx/timeout/key-eksik → RSS fallback
   - fetchPlayReviews(t): Google Play Reviews API + language_codes loop

3. Normalize → review rows → batch upsert (chunk 100, onConflict: project_id,source,external_id)

4. cron_runs tablosuna sonuç yaz:
   - run_id, started_at, ended_at, total_ingested, errors_count, per_property_result
```

### 5.2 ASC Customer Reviews API çağrısı

```ts
// JWT zaten app-store-connect.ts'deki makeJwt() pattern'ini paylaşır.
// Customer Reviews için aud aynı: "appstoreconnect-v1".

// GET /v1/apps/{appId}/customerReviews?limit=200&sort=-createdDate&filter[territory]=USA,TUR
//   ?include=response - response varsa included[] içinde döner

// İlk istek limit=200 (Apple max), sonraki istekler links.next üzerinden cursor pagination.
// 24 saatten eski yorumlara ulaşılana kadar pagination devam; hedef: "incremental" fetch
// (DB'deki son review_date'ten sonrasını çek; ilk fetch'te tüm liste).
```

**Karmaşıklık:** her property için O(pages × territories). Property başına ortalama < 5 sayfa beklenir (incremental). Cron 30dk: günlük ~48 invocation × N property.

**Fallback tetikleyicileri:**
- HTTP 401 (key invalid / scope eksik)
- HTTP 5xx
- `cfg.private_key` veya `cfg.key_id` boş
- Network timeout (10s)

Fallback durumunda mevcut RSS akışı çalışır (helm-reviews/index.ts:86-129 mantığı korunur, sadece factored out).

### 5.3 Google Play Reviews API çağrısı

```ts
// Auth: Service account JSON → JWT (alg: RS256, aud: oauth2.googleapis.com/token)
// → Access token (cache'le, 50dk TTL)
// → GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/reviews
//      ?maxResults=100&translationLanguage={lang}

// API SADECE son 7 günü döner - kayıp olmasın diye 30dk cron.
// Pagination: `tokenPagination.nextPageToken`. Tek property için ortalama < 3 sayfa.
```

**Önemli:** Google Play API'de yorum HER ZAMAN tekildir (Apple gibi territory çoğaltması yok). `language_codes` aslında **çeviri** dili - orijinal yorum üzerine seçilen dile çevirisi gelir. Default `["en", "tr"]` ile her yorum 2 kez çağrılır (token cache var, ucuz). Spec'te birinci dilin orijinal olduğunu varsayıyoruz; çeviri opsiyonel kalır.

### 5.4 Karmaşıklık özeti

- Time: O(P × (A_pages + (Play_pages × L)))
  - P = property sayısı, A_pages ≈ ASC pages/property, L = language_codes
  - Pratikte: P=5, A_pages=3, Play_pages=2, L=2 → 5 × (3 + 4) = 35 HTTP call/30dk
- Space: O(R) - R = batch upsert chunk (≤100)
- Cron başına latency hedef: < 30s (Edge Function timeout 60s)

## 6. Edge Function: `helm-review-reply` (yeni)

### 6.1 Akış

```
POST /functions/v1/helm-review-reply
Headers: Authorization: Bearer {user_jwt}
Body: { review_id: bigint, body: string }

1. JWT'den actor_email çıkar (helm-action pattern)
2. review_id → reviews row (project_id, source, external_id, territory, developer_response)
3. project_integrations.config'ten API key çek (source'a göre Apple/Google)
4. Body validation:
   - length 1..350 (Apple sınırı)
   - plain text (HTML/script reject)
   - trim whitespace
5. API call:
   - Apple ASC: review.developer_response varsa PATCH, yoksa POST
   - Google: PUT (idempotent - üzerine yazar)
6. Başarılı → update reviews set developer_response=$1, responded_at=now() where id=$2
7. audit_log insert: action='review.reply', payload={review_id, source, territory, body_length}
8. Response 200: { ok: true, responded_at }

Hata yolları (4xx, body içinde JSON):
  401  → "Entegrasyon yetkisi yok"   (Apple/Google API key invalid)
  422  → "Yanıt reddedildi: {msg}"   (Apple/Google body validation)
  429  → "Çok hızlısın, 1dk bekle"   (rate limit)
  5xx/timeout → "Sunucu yanıt vermedi"
```

### 6.2 Apple ASC Customer Review Responses

```ts
// Mevcut yanıt varsa PATCH /v1/customerReviewResponses/{response_id}
// Yoksa POST /v1/customerReviewResponses
//   body: { data: { type: "customerReviewResponses",
//                   attributes: { responseBody },
//                   relationships: { review: { data: { type: "customerReviews", id } } } } }
//
// Apple'ın customerReviews response'unda included[] içinde mevcut response objesi geliyor.
// helm-reviews ingest sırasında bu yakalanır → reviews.developer_response zaten dolu.
// Spec: ingest tarafı developer_response_id'yi YANIT KARARLI tutmak için ayrı kolonda
// saklamak ZORUNDA değil - reply endpoint'i ihtiyaç anında ASC'ye GET ile sorabilir
// (basit, az durum). Edge: response_id cache'i optimizasyon, spec dışı.
```

### 6.3 Google Play reviews.reply

```ts
// POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{pkg}/reviews/{reviewId}:reply
// body: { replyText: string }
// Idempotent - üzerine yazar; ayrı POST/PATCH ayrımı yok.
```

### 6.4 Rate limit

Spec sınırı: kullanıcı (actor_email) başına 10 yanıt/dakika. Memory'de basit sliding-window sayaç (Edge Function in-memory yetersiz, multi-instance'da sızar). **Çözüm:** `audit_log`'a SELECT - son 60s içinde `actor_email = X AND action='review.reply'` count > 10 ise 429. Tek query, ucuz (`audit_log` üzerinde `(actor_email, created_at)` index'i zaten gerekecek - bonus migration).

## 7. UI Değişiklikleri

### 7.1 Web - `helm/src/pages/reviews/index.tsx`

| # | Değişiklik |
|---|---|
| 1 | StatCard satırı 3'ten 5'e: **Genel ortalama**, **iOS ortalama**, **Android ortalama**, **Toplam yorum**, **Negatif (1-2★)** |
| 2 | Sayfa başlığı: "Yorumlar" (App Store etiketi kalkıyor) |
| 3 | Üst segmented control: **Tümü / iOS / Android** (mobil patterni) |
| 4 | Yorum satırı badge'leri: kaynak (`iOS`/`Android`), version (`v1.0.3`), territory (`TR`) |
| 5 | Yorum satırı altında: yanıt yoksa **"Yanıtla"** buton; yanıt varsa **alıntı blok** + "Düzenle" |
| 6 | Yanıt modal: textarea (350 char counter), Gönder/İptal; submit senkron → toast |

### 7.2 Mobil - `helm-mobile/app/(cockpit)/(reviews)/index.tsx`

| # | Değişiklik |
|---|---|
| 1 | Hero card avg'i platform filtre'ye göre değişir (segment iOS seçiliyse iOS avg) |
| 2 | `ReviewRow`: version + territory badge (mevcut star/title/body altında) |
| 3 | `ReviewRow` altında: **"Yanıtla"** buton veya **"Yanıtlandı"** chip + alıntı |
| 4 | Yanıt sheet: react-native Modal (transparent: true) - TextInput (multiline, 350 char counter) + "Gönder" |
| 5 | Senkron submit + `~/lib/toast` (zaten var) ile hata göstergesi |
| 6 | `useReviews` hook: source filter zaten var, sadece veriye Android satırları girmesi gerekiyor - değişiklik yok |

### 7.3 Property edit formu (web)

Mevcut `google_play_id` alanı korunur (commit 6acc26c). Yardımcı satır:

> "Google Play yorumları için Settings → Integrations → Google Play Developer bağlayın."

### 7.4 Settings → Integrations (web)

Yeni provider kartı: **"Google Play Developer"**
- Açıklama: "Yorumları çekmek ve yanıtlamak için service account JSON gerekir."
- Form: service account JSON textarea, package name (opsiyonel - property'den fallback), language codes (chips, default `en,tr`)
- "Bağla" butonu → `project_integrations` insert/update

## 8. Migration Sırası

| # | Migration | İçerik |
|---|---|---|
| 1 | `0024_reviews_v2.sql` | `reviews` kolon eklemeleri + mevcut row'lara `source_method='rss'` backfill |
| 2 | `0025_reviews_cron.sql` | `cron.schedule('helm-reviews-30m', '*/30 * * * *', ...)` |
| 3 | `0026_audit_actor_index.sql` | `create index on audit_log (actor_email, created_at desc)` - rate limit query'si için |

## 9. Deploy Sırası

1. Migration'lar (0024 → 0026)
2. Edge Function `helm-reviews` (refactored)
3. Edge Function `helm-review-reply` (yeni)
4. Web UI deploy (yeni kolonlar nullable → eski UI da çalışmaya devam)
5. Mobil EAS update (review.reply için Edge Function endpoint'ine bağımlı)

Geriye uyumluluk: web ve mobil eski sürümleri yeni Edge Function ile çalışır (yeni endpoint'leri çağırmıyorlarsa). Yeni UI eski Edge Function ile çalışmaz (404 toast verir).

## 10. Test Stratejisi

CLAUDE.md kuralı: **Unit test obsesyonu yasak**, **Mock data yasak**, gerçek DB üstünde manuel test.

### 10.1 Backend manuel

- Tek property için ASC key + service account ekle → `helm-reviews` invoke → reviews tablosu doluyor mu?
- ASC key'i geçici boz (yanlış issuer_id) → RSS fallback'i tetiklendiği `cron_runs.per_property_result` JSON'da kanıt
- 30dk cron beklenir, `cron_runs` tablosunda otomatik satır oluşmalı

### 10.2 Yanıtlama manuel

- TestFlight beta review'ına (Apple) yanıt yaz → `reviews.developer_response` dolar, audit_log entry oluşur, App Store Connect web'de gerçek yanıt görünür
- Google Play internal test track'inde aynısı

### 10.3 Negatif yollar

- Boş body → 422
- 400 char body → 422
- API key yanlış → 401 + "Entegrasyon yetkisi yok"
- 11 yanıt/dakika → 11.'sinde 429

## 11. Performans Hedefleri

- `helm-reviews` cron run latency: P95 < 30s (Edge timeout 60s)
- `helm-review-reply` latency: P95 < 3s (Apple/Google API round-trip + audit insert)
- Reviews tablosu büyümesi: günlük yeni satır beklentisi ~100-500 (indie portföy ölçeği) - partition'a şu an gerek yok
- Index'ler:
  - `reviews_project_date_idx` (mevcut, `(project_id, review_date desc)`) korunur
  - `audit_log (actor_email, created_at desc)` yeni (rate limit query'si)

## 12. Risk ve Trade-off'lar

| Risk | Etki | Önlem |
|---|---|---|
| ASC API rate limit (3500 req/h Apple tarafı, key başına) | Orta | Cron 30dk + incremental fetch (son review_date'ten sonra) |
| Google Play 7g sınırı | Yüksek (kayıp riski) | 30dk cron yeterli; iki cron arası 7g'den kısa |
| Service account JSON sızıntısı | Kritik | `project_integrations.config` RLS service_role only; audit_log'da gövde tutulmaz |
| Apple key'in "Customer Reviews" scope'u yoksa | Orta | Otomatik RSS fallback; UI'da Settings sayfasında uyarı banner |
| Hibrit kaynak dedupe çakışması | Düşük | `external_id` prefix ile method ayrımı; UNIQUE (project_id, source, external_id) |
| Yanıt 350 char limit (Apple) | Düşük | UI'da live char counter, gönder butonu disable |

## 13. Scope Dışı (Backlog)

- **Yanıt silme** - Apple ASC `DELETE` + Google reviews.delete (Reply silme yok aslında, sadece edit). YAGNI; sonra eklenir.
- **Push trigger**: ≤2★ yorum geldiğinde mobil push - bu **B alt-projesi**.
- **Rating delta widget**: 7g/30g rating spike - **D alt-projesi**.
- **Mobil ekran sayısı kısıtlama** ("acil aksiyon" odağı) - **C alt-projesi**.
- **Yanıt taslakları / template**: yanıtın kaydedilip sonra gönderilmesi. Şu an senkron-only.
- **ML/sentiment analiz**: yorumların pozitif/negatif/nötr sınıflandırması.

## 14. Açık Sorular

Spec onayında karara bağlanacak:

1. **Web yanıt UI'sı** - modal mı popover mu? Tasarım önerisi modal (daha geniş alan, mobile uyumu kolay). Karar: **modal** (default).
2. **Mobil yanıt sheet'i** - React Native Modal vs gorhom/bottom-sheet? Mobile şu an gorhom kullanmıyor (`bun.lock`'ta yok). Karar: **Modal** (yeni dependency yok).
3. **Çoklu dil** Google Play tarafında - default `["en", "tr"]` mı, ilk fetch'te boş bırakıp dil tespitini Apple/Google'a mı bırakalım? Karar: **default `["en", "tr"]`** (Türkçe + İngilizce çoğunluğu kapsar; user portföyü TR ağırlıklı).

## 15. Sonraki Adım

Bu spec onaylandığında `superpowers:writing-plans` skill ile implementation plan yazılır - adım adım dosya değişiklikleri + migration order + her adım için verification.
