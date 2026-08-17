# Provider Entegrasyon Spec'leri

Faz 4 MVP: **RevenueCat**, **App Store Connect**, **Sentry**.  
Diğer provider'lar Faz 4 sonrası.

## Özet tablo

| Provider | Bağlantı tipi | MVP | Sync | Normalize → |
|----------|---------------|-----|------|-------------|
| `revenuecat` | API key paste | ✓ | webhook + hourly | `metrics` |
| `appstoreconnect` | JWT (.p8) | ✓ | 6h poll | `metrics`, `reviews` |
| `sentry` | Auth token | ✓ | webhook + 6h | issues / `metrics` |
| `admob` | Google OAuth | v1.1 | daily | `metrics` (ad_revenue) |
| `posthog` | API key | v1.1 | daily | `metrics` (dau, funnel) |
| `supabase` | Service role (read) | v1.1 | 6h | users → DAU |
| `resend` | API key | v2 | daily | delivery stats |
| `rest` | URL + mapping | beta | configurable | custom |

---

## RevenueCat

### Kullanıcı adımları (web wizard)

1. RevenueCat → Project Settings → API Keys
2. Secret API key kopyala (veya public + secret pair)
3. Helm: property seç → key yapıştır → **Test connection**
4. İlk sync başlar

### credentials (encrypted)

```json
{
  "secret_api_key": "sk_..."
}
```

### config (plain)

```json
{
  "revenuecat_project_id": "proj_xxx",
  "app_ids": ["app_xxx"]
}
```

### validateCredentials

```
GET https://api.revenuecat.com/v1/subscribers/{test_id}
Authorization: Bearer {secret_api_key}
```

veya v2 overview metrics endpoint (RC API versiyonuna göre güncelle).

### sync

| RC metrik | Hub `metric` |
|-----------|--------------|
| MRR | `mrr` |
| Active subscriptions | `active_subs` |
| New subscribers | `new_users` |
| Churn | türetilmiş alert input |

Upsert: `(project_id, date, metric, value)`.

### webhook (opsiyonel MVP+)

RevenueCat → Helm Edge fn URL  
Events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`  
→ near-real-time metric bump + alert trigger

### Plan limiti

- Free: daily sync
- Founder+: hourly

---

## App Store Connect

### Kullanıcı adımları

1. App Store Connect → Users → Keys → App Store Connect API
2. Issuer ID, Key ID, `.p8` private key download
3. Helm wizard: üç alan + `.p8` upload
4. **Test connection** → app listesi otomatik

### credentials (encrypted)

```json
{
  "issuer_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "key_id": "XXXXXXXXXX",
  "private_key_pem": "-----BEGIN PRIVATE KEY-----\n..."
}
```

### config

```json
{
  "bundle_ids": ["com.example.app"],
  "app_apple_ids": ["1234567890"]
}
```

### validateCredentials

JWT mint (ES256, 20min expiry) →  
`GET https://api.appstoreconnect.apple.com/v1/apps?limit=1`

### sync jobs

| API | Hub hedef | Sıklık |
|-----|-----------|--------|
| Sales and Trends Reports | `metrics`: proceeds, downloads | 6h |
| Customer Reviews | `reviews` tablosu | 6h |
| App Store Versions | versions metadata | 12h |

### reviews normalize

```typescript
{
  project_id,
  source: "appstore",
  external_id,
  author, rating, title, body,
  territory, app_version,
  review_date,
  developer_response, responded_at
}
```

Mobile `use-reviews` + `useReviewReply` bu şemayı okur.

### Güvenlik

- `.p8` sadece Vault; worker decrypt, log yok
- Upload UI: file picker → server-side encrypt → client'e geri dönmez

---

## Sentry

### Kullanıcı adımları

1. Sentry → Settings → Developer Settings → Internal Integration
2. Scopes: `project:read`, `event:read` (minimum)
3. Token + Organization slug + Project slug

### credentials

```json
{
  "auth_token": "sntrys_...",
  "org_slug": "my-org",
  "project_slug": "my-app"
}
```

### validateCredentials

```
GET https://sentry.io/api/0/projects/{org}/{project}/
Authorization: Bearer {auth_token}
```

### sync

| Sentry | Hub |
|--------|-----|
| Unresolved issues | `sentry_issues` veya metrics: `open_errors` |
| Event count 24h | `metrics`: `error_count` |

Mobile: `use-sentry-issues.ts` — mevcut ekran `more/errors.tsx`.

### webhook

`issue.created`, `issue.resolved` → alert rule tetikle

---

## AdMob (v1.1)

### Bağlantı

Google OAuth2 → refresh token Vault

### sync

AdMob Reporting API → `metrics.ad_revenue` (günlük)

Mobile KPI tile zaten `ad_revenue` okur (`use-cockpit-kpis`).

---

## PostHog (v1.1)

### credentials

```json
{ "api_key": "phc_...", "host": "https://app.posthog.com" }
```

### sync

Daily active users → `metrics.dau` (Supabase DAU ile reconcile — property config'de primary source seç)

---

## Supabase property (v1.1)

Müşterinin **kendi app Supabase'i** (Helm hub değil).

### credentials

```json
{
  "project_url": "https://xxx.supabase.co",
  "service_role_key": "..." 
}
```

**Not:** Hosted SaaS v1'de opsiyonel; Enterprise / BYOK.

### sync

`auth.users` → total users, last_sign_in → DAU  
Mevcut logic: `use-users.ts`, `use-property-dau.ts`

---

## REST generic (beta)

Power user escape hatch.

### config UI

- URL template
- Headers (Bearer {{secret}})
- JSON path → metric mapping

```json
{
  "mappings": [
    { "path": "$.data.mrr", "metric": "mrr" }
  ]
}
```

---

## Entegrasyon → modül eşlemesi

Property `enabled_modules` ile KPI tile görünürlüğü (`src/lib/modules.ts`):

| Module | Gerekli provider |
|--------|------------------|
| `subscriptions` | revenuecat |
| `ads` | admob |
| `users` | supabase veya posthog |
| `reviews` | appstoreconnect |
| `analytics` | posthog |
| errors (implicit) | sentry |

Wizard: entegrasyon bağlandığında ilgili modül otomatik enable önerisi.

---

## Faz 4 MVP checklist

- [ ] `ProviderAdapter` interface + registry
- [ ] RevenueCat adapter + wizard
- [ ] App Store Connect adapter + wizard + reviews sync
- [ ] Sentry adapter + wizard
- [ ] Sync worker deploy + cron
- [ ] `sync_runs` + health UI retry
- [ ] Beta: 5 user, connect success > 90%

## İlgili

- [architecture.md](./architecture.md)
- Sync frekans limitleri plan bazlıdır; varsayılan saatlik cron için `helm-ingest`'e bak.
