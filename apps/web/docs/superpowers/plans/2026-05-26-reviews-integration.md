# Reviews Entegrasyon Onarımı - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Store + Google Play yorumlarını web + mobil için tek backend üzerinden çek, 30dk cron ile otomatik tazele, yanıtlama yolunu aç.

**Architecture:** Mevcut `helm-reviews` Edge Function'ı App Store Connect Customer Reviews API + iTunes RSS fallback + Google Play Reviews API'yi koordine eden bir orchestrator'a refactor edilir. Yeni `helm-review-reply` Edge Function'ı senkron yanıt yazımı yapar. Cron pg_cron + vault.decrypted_secrets pattern'ini kullanır.

**Tech Stack:** Deno (Supabase Edge Functions), Postgres + pg_cron + pg_net, Refine/React 19 (web), Expo SDK 56 / React Native (mobil), Zod, TanStack Query, shadcn/ui, NativeWind.

**Spec:** `docs/superpowers/specs/2026-05-26-reviews-integration-design.md`

---

## ⚠️ Spec'e göre düzeltmeler (plan tarafından gözlemlendi)

1. **Migration numaraları kaydı**: Spec'te `0024_reviews_v2.sql` yazıyordu - `0024_audit_actor.sql` zaten alınmış. Düzeltme: `0025_reviews_v2.sql`, `0026_reviews_cron.sql`, `0027_audit_actor_composite_idx.sql`.
2. **`cron_runs` tablosu yok**: Spec'te bahsedildi ama mevcut değil. Bunun yerine cron çalışma kayıtları `audit_log`'a `action='system.reviews_ingest'` olarak yazılır (project_id null, target_user null, detail = JSON string).
3. **audit_log schema ekleme yok**: `target_review_id` ayrı kolon eklenmez; `detail` text alanına JSON string yazılır (`{"review_id": 42, "source": "appstore", "body_length": 200}`).

---

## File Structure

### Yeni dosyalar
- `supabase/migrations/0025_reviews_v2.sql`
- `supabase/migrations/0026_reviews_cron.sql`
- `supabase/migrations/0027_audit_actor_composite_idx.sql`
- `supabase/functions/_shared/asc-jwt.ts` - ASC JWT helper (paylaşılan)
- `supabase/functions/_shared/cors.ts` - CORS sabit (DRY)
- `supabase/functions/helm-reviews/asc.ts` - ASC Customer Reviews API
- `supabase/functions/helm-reviews/rss.ts` - iTunes RSS fallback
- `supabase/functions/helm-reviews/play.ts` - Google Play Reviews API + token cache
- `supabase/functions/helm-review-reply/index.ts` - orchestrator
- `supabase/functions/helm-review-reply/asc-reply.ts` - Apple reply
- `supabase/functions/helm-review-reply/play-reply.ts` - Google reply
- `src/pages/reviews/reply-modal.tsx` - web yanıt modal
- `src/components/integrations-panel/google-play-developer-card.tsx` - web provider kartı
- `helm-mobile/src/components/review-reply-sheet.tsx` - mobil yanıt sheet
- `helm-mobile/src/hooks/use-review-reply.ts` - mobil reply mutation

### Değişen dosyalar
- `supabase/functions/helm-reviews/index.ts` - orchestrator refactor
- `supabase/functions/helm-ingest/connectors/app-store-connect.ts` - JWT helper'ı _shared'e taşı
- `src/pages/reviews/index.tsx` - 5 stat card, platform segment, ReviewRow badge, reply button
- `src/types/index.ts` veya benzeri - `Review` tipi yeni kolonlar
- `helm-mobile/app/(cockpit)/(reviews)/index.tsx` - hero avg platform-aware
- `helm-mobile/src/components/review-row.tsx` - badge'ler + reply button
- `helm-mobile/src/hooks/use-reviews.ts` - Review tipi güncelleme

---

## Task 1: Migration 0025 - reviews v2 kolonları

**Files:**
- Create: `supabase/migrations/0025_reviews_v2.sql`

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- helm - reviews v2: yeni kaynak (Google Play), version + territory + yanıt alanları.
-- ASC Customer Reviews API'ye geçiş için source_method ayrımı.

alter table public.reviews
  add column if not exists territory          text,
  add column if not exists app_version        text,
  add column if not exists developer_response text,
  add column if not exists responded_at       timestamptz,
  add column if not exists source_method      text;

-- Mevcut row'lar RSS kaynaklı - backfill
update public.reviews
  set source_method = 'rss'
  where source_method is null and source = 'appstore';

comment on column public.reviews.source is
  '''appstore'' (iOS) veya ''playstore'' (Android)';
comment on column public.reviews.source_method is
  '''asc'' (App Store Connect API) | ''rss'' (iTunes RSS) | ''play'' (Google Play API)';
comment on column public.reviews.territory is
  'iOS: ISO 3166-1 alpha-2 country (us, tr); Android: language code (en, tr)';
```

- [ ] **Step 2: Migration'ı uygula**

Run: `supabase db push` (Supabase CLI üzerinden) veya Supabase dashboard SQL Editor'da çalıştır
Expected: "ALTER TABLE" + "UPDATE N" başarılı, hata yok

- [ ] **Step 3: Backfill'i doğrula**

```sql
select count(*) as total,
       count(*) filter (where source_method = 'rss') as rss_count
from public.reviews
where source = 'appstore';
```
Expected: `total = rss_count` (tüm eski iOS row'lar RSS olarak işaretli)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0025_reviews_v2.sql
git commit -m "feat(helm): WES-000 0025 reviews v2 - territory + app_version + developer_response + source_method"
```

---

## Task 2: Migration 0027 - audit_log composite index

**Files:**
- Create: `supabase/migrations/0027_audit_actor_composite_idx.sql`

(0026 cron'dan önce yapılır çünkü cron başlatıldığında ingest'ler audit_log'a yazmaya başlar)

- [ ] **Step 1: Migration yaz**

```sql
-- helm - review.reply rate limit + cron run history query'leri için composite index.
-- "Son 60s içinde actor X kaç yanıt yazdı?" sorgu desteği.

create index if not exists audit_log_actor_created_idx
  on public.audit_log (actor_email, created_at desc);

-- Mevcut audit_log_actor_idx (sadece actor_email) artık redundant; düşürülmez (rollback kolaylığı)
```

- [ ] **Step 2: Uygula**

Run: `supabase db push`
Expected: "CREATE INDEX" başarılı

- [ ] **Step 3: Index'in kullanıldığını doğrula**

```sql
explain (analyze, buffers)
select count(*) from public.audit_log
where actor_email = 'test@example.com'
  and created_at > now() - interval '60 seconds';
```
Expected: `Index Scan using audit_log_actor_created_idx`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0027_audit_actor_composite_idx.sql
git commit -m "feat(helm): WES-000 0027 audit_log composite index - actor_email + created_at desc (rate limit query)"
```

---

## Task 3: `_shared/` klasörü + CORS + ASC JWT helper

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/asc-jwt.ts`
- Modify: `supabase/functions/helm-ingest/connectors/app-store-connect.ts` (JWT'yi _shared'den import et)

- [ ] **Step 1: CORS sabitini yaz**

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
```

- [ ] **Step 2: ASC JWT helper'ı yaz**

```typescript
// supabase/functions/_shared/asc-jwt.ts
// App Store Connect API için JWT (ES256). app-store-connect.ts ve helm-reviews paylaşır.

export interface ASCKeyConfig {
  key_id: string;
  issuer_id?: string;
  private_key: string;
}

const b64url = (data: ArrayBuffer | Uint8Array | string): string => {
  let bytes: Uint8Array;
  if (typeof data === "string") bytes = new TextEncoder().encode(data);
  else if (data instanceof Uint8Array) bytes = data;
  else bytes = new Uint8Array(data);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const pemToDer = (pem: string): Uint8Array => {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
};

export async function makeAscJwt(config: ASCKeyConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: config.key_id, typ: "JWT" };
  const payload: Record<string, unknown> = {
    iat: now,
    exp: now + 1199,
    aud: "appstoreconnect-v1",
  };
  if (config.issuer_id && config.issuer_id.trim().length > 0) {
    payload.iss = config.issuer_id;
  } else {
    payload.sub = "user";
  }
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const der = pemToDer(config.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(sig)}`;
}
```

- [ ] **Step 3: `app-store-connect.ts`'i refactor et - JWT'yi _shared'den al**

`supabase/functions/helm-ingest/connectors/app-store-connect.ts` dosyasının başındaki `b64url`, `pemToDer`, `makeJwt` fonksiyonlarını sil; üst kısma şunu ekle:

```typescript
import { makeAscJwt } from "../../_shared/asc-jwt.ts";
```

`fetchAppStoreConnect` içindeki `const jwt = await makeJwt(config as Record<string, string>);` satırını:

```typescript
const jwt = await makeAscJwt(config as unknown as { key_id: string; issuer_id?: string; private_key: string });
```

- [ ] **Step 4: Diff'i doğrula**

Run: `git diff supabase/functions/helm-ingest/connectors/app-store-connect.ts | wc -l`
Expected: ~80 satır azalış (JWT kodu çıktı). Dosyanın işlevsel kısmı (fetchDailyReport, parseTsv) korunmuş olmalı.

- [ ] **Step 5: Edge Function deploy + smoke test**

Run: `supabase functions deploy helm-ingest`
Sonra Supabase dashboard'dan veya kod tarafından bir property için helm-ingest'i invoke et (app-store-connect provider'lı). Sales raporu çekiyor mu? (Düne ait rapor olmayabilir, 404 normal - auth başarısı 401 değil 404 dönmeli)

Expected: 200 response, sales data veya boş `points` (rapor yoksa) - 401 dönerse JWT helper kırılmış demektir.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/_shared/asc-jwt.ts supabase/functions/helm-ingest/connectors/app-store-connect.ts
git commit -m "refactor(helm): WES-000 _shared/ klasörü - CORS + ASC JWT helper, app-store-connect connector'ı temizlendi"
```

---

## Task 4: `helm-reviews/asc.ts` - App Store Connect Customer Reviews

**Files:**
- Create: `supabase/functions/helm-reviews/asc.ts`

- [ ] **Step 1: ASC reviews fetcher'ı yaz**

```typescript
// supabase/functions/helm-reviews/asc.ts
// App Store Connect Customer Reviews API.
// JWT _shared/asc-jwt.ts'den; 401/5xx/timeout → caller RSS fallback'e döner.

import { makeAscJwt, type ASCKeyConfig } from "../_shared/asc-jwt.ts";

export interface AscReviewRow {
  project_id: string;
  source: "appstore";
  source_method: "asc";
  external_id: string;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory: string | null;
  app_version: string | null;
  developer_response: string | null;
  responded_at: string | null;
  review_date: string | null;
}

interface AscResponseAttrs {
  responseBody?: string;
  lastModifiedDate?: string;
}
interface AscReviewAttrs {
  rating?: number;
  title?: string;
  body?: string;
  reviewerNickname?: string;
  createdDate?: string;
  territory?: string;
}
interface AscReviewResource {
  id: string;
  attributes?: AscReviewAttrs;
  relationships?: { response?: { data?: { id: string } } };
}
interface AscIncluded {
  id: string;
  type: string;
  attributes?: AscResponseAttrs;
}
interface AscPage {
  data?: AscReviewResource[];
  included?: AscIncluded[];
  links?: { next?: string };
}

const TIMEOUT_MS = 10_000;

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

export interface AscFetchInput {
  projectId: string;
  appId: string;             // App Store app ID (numeric)
  ascKey: ASCKeyConfig;
  sinceDate?: string | null; // ISO; bu tarihten sonraki yorumları çek (incremental)
}

export interface AscFetchResult {
  ok: true;
  rows: AscReviewRow[];
  pages: number;
}
export interface AscFetchError {
  ok: false;
  shouldFallback: boolean;   // RSS'e dön
  status?: number;
  message: string;
}

export async function fetchAscReviews(
  input: AscFetchInput,
): Promise<AscFetchResult | AscFetchError> {
  let jwt: string;
  try {
    jwt = await makeAscJwt(input.ascKey);
  } catch (e) {
    return {
      ok: false,
      shouldFallback: true,
      message: `JWT üretilemedi: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const rows: AscReviewRow[] = [];
  let pages = 0;
  let nextUrl: string | null =
    `https://api.appstoreconnect.apple.com/v1/apps/${input.appId}/customerReviews` +
    `?limit=200&sort=-createdDate&include=response`;

  while (nextUrl && pages < 20) { // hard cap; ilk fetch sınırı
    let res: Response;
    try {
      res = await fetchWithTimeout(nextUrl, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
    } catch (e) {
      return {
        ok: false,
        shouldFallback: true,
        message: `Timeout/network: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    if (res.status === 401) {
      return {
        ok: false,
        shouldFallback: true,
        status: 401,
        message: "ASC 401 - key invalid veya Customer Reviews scope yok",
      };
    }
    if (res.status >= 500) {
      return {
        ok: false,
        shouldFallback: true,
        status: res.status,
        message: `ASC ${res.status}`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        shouldFallback: false, // 4xx (404 vs) - fallback'e dönmeye gerek yok
        status: res.status,
        message: `ASC ${res.status}: ${await res.text()}`,
      };
    }

    const page = (await res.json()) as AscPage;
    pages++;

    // included[] içinde response'ları map'le
    const responseById = new Map<string, AscResponseAttrs>();
    for (const inc of page.included ?? []) {
      if (inc.type === "customerReviewResponses" && inc.attributes) {
        responseById.set(inc.id, inc.attributes);
      }
    }

    let reachedSince = false;
    for (const rev of page.data ?? []) {
      const attrs = rev.attributes ?? {};
      const createdAt = attrs.createdDate ?? null;
      if (input.sinceDate && createdAt && createdAt <= input.sinceDate) {
        reachedSince = true;
        break;
      }
      const respId = rev.relationships?.response?.data?.id;
      const respAttrs = respId ? responseById.get(respId) : undefined;
      const territory = (attrs.territory ?? "").toLowerCase() || null;

      rows.push({
        project_id: input.projectId,
        source: "appstore",
        source_method: "asc",
        external_id: `asc:${territory ?? "xx"}:${rev.id}`,
        author: attrs.reviewerNickname ?? null,
        rating: typeof attrs.rating === "number" ? attrs.rating : null,
        title: attrs.title ?? null,
        body: attrs.body ?? null,
        territory,
        app_version: null, // ASC Customer Reviews v1 response'unda yok; ileri sürüm gerekiyor
        developer_response: respAttrs?.responseBody ?? null,
        responded_at: respAttrs?.lastModifiedDate ?? null,
        review_date: createdAt,
      });
    }

    if (reachedSince) break;
    nextUrl = page.links?.next ?? null;
  }

  return { ok: true, rows, pages };
}
```

> **Not:** Apple'ın `customerReviews` v1 response'unda `app_version` field'ı **yok** (Apple bunu sales raporlarına bağlı tutmuş). `app_version` kolonu null kalır; Play API'de var, ona kullanırız.

- [ ] **Step 2: Type-check için lokal deno kontrol**

Run: `cd supabase/functions && deno check helm-reviews/asc.ts`
Expected: hata yok

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/helm-reviews/asc.ts
git commit -m "feat(helm): WES-000 helm-reviews ASC Customer Reviews API fetcher - incremental + response include"
```

---

## Task 5: `helm-reviews/rss.ts` - iTunes RSS fallback

**Files:**
- Create: `supabase/functions/helm-reviews/rss.ts`

(Mevcut helm-reviews/index.ts:86-129 mantığını çıkarıp module yapacağız)

- [ ] **Step 1: RSS fetcher'ı yaz**

```typescript
// supabase/functions/helm-reviews/rss.ts
// iTunes RSS - public, auth gerektirmez. ASC fallback'i olarak kalır.

export interface RssReviewRow {
  project_id: string;
  source: "appstore";
  source_method: "rss";
  external_id: string;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory: string;
  app_version: string | null;
  developer_response: string | null;
  responded_at: string | null;
  review_date: string | null;
}

export interface RssFetchInput {
  projectId: string;
  appId: string;
  countries: string[];
}

export interface RssFetchResult {
  rows: RssReviewRow[];
  perCountry: Array<{ country: string; reviews: number; error?: string }>;
}

export async function fetchRssReviews(
  input: RssFetchInput,
): Promise<RssFetchResult> {
  const rows: RssReviewRow[] = [];
  const perCountry: RssFetchResult["perCountry"] = [];

  for (const country of input.countries) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${input.appId}/sortby=mostrecent/json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`RSS ${res.status}`);
      const feed = await res.json();
      const raw = feed.feed?.entry;
      const entries: Array<Record<string, any>> = Array.isArray(raw)
        ? raw
        : raw
        ? [raw]
        : [];

      const countryRows = entries
        .filter((e) => e["im:rating"]) // ilk entry app meta - atla
        .map((e): RssReviewRow => ({
          project_id: input.projectId,
          source: "appstore",
          source_method: "rss",
          external_id: `rss:${country}:${e.id?.label ?? ""}`,
          author: e.author?.name?.label ?? null,
          rating: Number(e["im:rating"]?.label ?? 0) || null,
          title: e.title?.label ?? null,
          body: e.content?.label ?? null,
          territory: country,
          app_version: e["im:version"]?.label ?? null,
          developer_response: null,
          responded_at: null,
          review_date: e.updated?.label ?? null,
        }));

      rows.push(...countryRows);
      perCountry.push({ country, reviews: countryRows.length });
    } catch (e) {
      perCountry.push({
        country,
        reviews: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { rows, perCountry };
}
```

> **Bonus:** RSS'te `im:version` field'ı vardır (Apple iTunes RSS extension). ASC API'de olmayan `app_version` bilgisi RSS fallback'inde elde edilir.

- [ ] **Step 2: Type check**

Run: `cd supabase/functions && deno check helm-reviews/rss.ts`
Expected: hata yok

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/helm-reviews/rss.ts
git commit -m "feat(helm): WES-000 helm-reviews RSS fallback fetcher modüle çıkarıldı - im:version artık app_version'a düşüyor"
```

---

## Task 6: `helm-reviews/play.ts` - Google Play Reviews API

**Files:**
- Create: `supabase/functions/helm-reviews/play.ts`

- [ ] **Step 1: Google Play fetcher + service account token cache**

```typescript
// supabase/functions/helm-reviews/play.ts
// Google Play Developer Reviews API.
// API SADECE son 7 günü döner - cron 30dk ile kayıp olmaz.

export interface PlayReviewRow {
  project_id: string;
  source: "playstore";
  source_method: "play";
  external_id: string;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory: string | null; // language code
  app_version: string | null;
  developer_response: string | null;
  responded_at: string | null;
  review_date: string | null;
}

export interface PlayFetchInput {
  projectId: string;
  packageName: string;
  serviceAccountJson: string;
  languageCodes: string[]; // default ["en", "tr"]
}

interface PlayReviewApi {
  reviewId: string;
  authorName?: string;
  comments?: Array<{
    userComment?: {
      text?: string;
      lastModified?: { seconds?: string };
      starRating?: number;
      reviewerLanguage?: string;
      appVersionName?: string;
    };
    developerComment?: {
      text?: string;
      lastModified?: { seconds?: string };
    };
  }>;
}

interface PlayPage {
  reviews?: PlayReviewApi[];
  tokenPagination?: { nextPageToken?: string };
}

// In-memory access token cache. Edge Function instance lifetime'ı boyunca yaşar.
// Multi-instance senaryosunda her instance ayrı token alır - kabul edilebilir.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  const cacheKey = sa.client_email;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  // RS256 JWT for Google OAuth2
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signingInput =
    b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(claim));

  const pem = sa.private_key.replace(/\\n/g, "\n");
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google OAuth ${tokenRes.status}: ${await tokenRes.text()}`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache.set(cacheKey, {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  });
  return tokenData.access_token;
}

export async function fetchPlayReviews(
  input: PlayFetchInput,
): Promise<{ rows: PlayReviewRow[]; pages: number } | { error: string }> {
  let token: string;
  try {
    token = await getAccessToken(input.serviceAccountJson);
  } catch (e) {
    return { error: `OAuth: ${e instanceof Error ? e.message : String(e)}` };
  }

  const rows: PlayReviewRow[] = [];
  let pages = 0;

  // Language codes: çeviri opsiyonu. Default ["en", "tr"]; aynı yorum farklı dillerde tekrarlanabilir
  // ama reviewId aynıdır → upsert dedupe edip son halini tutar.
  for (const lang of input.languageCodes) {
    let pageToken: string | undefined;
    do {
      const url = new URL(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/reviews`,
      );
      url.searchParams.set("maxResults", "100");
      url.searchParams.set("translationLanguage", lang);
      if (pageToken) url.searchParams.set("token", pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { error: `Play ${res.status}: ${await res.text()}` };
      }
      const page = (await res.json()) as PlayPage;
      pages++;

      for (const rev of page.reviews ?? []) {
        const userComment = rev.comments?.[0]?.userComment;
        const devComment = rev.comments?.[0]?.developerComment;
        if (!userComment) continue;
        const reviewSeconds = Number(userComment.lastModified?.seconds ?? 0);
        const respSeconds = Number(devComment?.lastModified?.seconds ?? 0);
        rows.push({
          project_id: input.projectId,
          source: "playstore",
          source_method: "play",
          external_id: `play:${userComment.reviewerLanguage ?? lang}:${rev.reviewId}`,
          author: rev.authorName ?? null,
          rating: userComment.starRating ?? null,
          title: null, // Play API'de title yok
          body: userComment.text ?? null,
          territory: userComment.reviewerLanguage ?? lang,
          app_version: userComment.appVersionName ?? null,
          developer_response: devComment?.text ?? null,
          responded_at: respSeconds ? new Date(respSeconds * 1000).toISOString() : null,
          review_date: reviewSeconds ? new Date(reviewSeconds * 1000).toISOString() : null,
        });
      }

      pageToken = page.tokenPagination?.nextPageToken;
    } while (pageToken && pages < 20);
  }

  return { rows, pages };
}
```

- [ ] **Step 2: Type check**

Run: `cd supabase/functions && deno check helm-reviews/play.ts`
Expected: hata yok

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/helm-reviews/play.ts
git commit -m "feat(helm): WES-000 helm-reviews Google Play Reviews API fetcher - service account JWT + access token cache + 7g pagination"
```

---

## Task 7: `helm-reviews/index.ts` - orchestrator refactor

**Files:**
- Modify: `supabase/functions/helm-reviews/index.ts` (komple rewrite)

- [ ] **Step 1: Yeni orchestrator'ı yaz**

```typescript
// supabase/functions/helm-reviews/index.ts
// Orchestrator: ASC + RSS fallback + Google Play. 30dk cron tarafından çağrılır.
//
// Konfig kaynakları:
//   project_integrations.provider='app_store_connect' enabled=true → ASC API (cfg.app_store_id + cfg.key_id + cfg.issuer_id + cfg.private_key)
//   projects.app_store_id (any value)                              → RSS fallback (cfg yoksa veya ASC fail)
//   project_integrations.provider='google_play_developer' enabled=true → Play API (cfg.service_account_json + cfg.package_name?)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { fetchAscReviews, type AscReviewRow } from "./asc.ts";
import { fetchRssReviews, type RssReviewRow } from "./rss.ts";
import { fetchPlayReviews, type PlayReviewRow } from "./play.ts";

interface ProjectRow {
  id: string;
  app_store_id: string | null;
  app_store_country: string | null;
  google_play_id: string | null;
}

interface IntegrationRow {
  project_id: string;
  provider: string;
  config: Record<string, unknown> | null;
}

type ReviewRow = AscReviewRow | RssReviewRow | PlayReviewRow;

const parseCountries = (raw: string | null | undefined): string[] => {
  if (!raw) return ["us"];
  const list = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : ["us"];
};

// Chunked upsert - 100 satırlık batch'ler. Supabase REST tek upsert call'da yüksek hacim kabul etmiyor.
async function upsertReviews(
  hub: ReturnType<typeof createClient>,
  rows: ReviewRow[],
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await hub
      .from("reviews")
      .upsert(chunk, { onConflict: "project_id,source,external_id" });
    if (error) errors.push(error.message);
    else ok += chunk.length;
  }
  return { ok, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [{ data: projects, error: pErr }, { data: integrations, error: iErr }] =
    await Promise.all([
      hub
        .from("projects")
        .select("id, app_store_id, app_store_country, google_play_id"),
      hub
        .from("project_integrations")
        .select("project_id, provider, config")
        .in("provider", ["app_store_connect", "google_play_developer"])
        .eq("enabled", true),
    ]);
  if (pErr) return json({ error: pErr.message }, 500);
  if (iErr) return json({ error: iErr.message }, 500);

  // integration lookup
  const ascByProject = new Map<string, IntegrationRow>();
  const playByProject = new Map<string, IntegrationRow>();
  for (const it of (integrations ?? []) as IntegrationRow[]) {
    if (it.provider === "app_store_connect") ascByProject.set(it.project_id, it);
    else if (it.provider === "google_play_developer") playByProject.set(it.project_id, it);
  }

  // sinceDate map: incremental fetch için son review_date'i çek
  const projectIds = (projects ?? []).map((p) => (p as ProjectRow).id);
  const sinceMap = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: maxRows } = await hub
      .from("reviews")
      .select("project_id, review_date")
      .in("project_id", projectIds)
      .order("review_date", { ascending: false })
      .limit(1000); // basit; gerçek max için RPC daha hızlı ama YAGNI
    for (const r of (maxRows ?? []) as { project_id: string; review_date: string | null }[]) {
      if (!r.review_date) continue;
      const cur = sinceMap.get(r.project_id);
      if (!cur || r.review_date > cur) sinceMap.set(r.project_id, r.review_date);
    }
  }

  const results: Array<Record<string, unknown>> = [];
  const allRows: ReviewRow[] = [];

  // App Store: paralel her property
  const appPromises = (projects ?? []).map(async (p) => {
    const proj = p as ProjectRow;
    const integ = ascByProject.get(proj.id);
    const cfg = (integ?.config ?? {}) as Record<string, string | undefined>;
    const ascAppId = (cfg.app_store_id || proj.app_store_id || "").trim();
    if (!ascAppId) return { projectId: proj.id, app: "skip" };

    const hasAscKey = cfg.key_id && cfg.private_key;
    if (hasAscKey) {
      const r = await fetchAscReviews({
        projectId: proj.id,
        appId: ascAppId,
        ascKey: {
          key_id: cfg.key_id!,
          issuer_id: cfg.issuer_id,
          private_key: cfg.private_key!,
        },
        sinceDate: sinceMap.get(proj.id) ?? null,
      });
      if (r.ok) {
        allRows.push(...r.rows);
        return { projectId: proj.id, app: { method: "asc", count: r.rows.length, pages: r.pages } };
      }
      if (!r.shouldFallback) {
        return { projectId: proj.id, app: { method: "asc", error: r.message, status: r.status } };
      }
      // ASC fail → RSS fallback
    }

    const countries = parseCountries(cfg.app_store_country ?? proj.app_store_country);
    const rss = await fetchRssReviews({ projectId: proj.id, appId: ascAppId, countries });
    allRows.push(...rss.rows);
    return {
      projectId: proj.id,
      app: { method: "rss", count: rss.rows.length, perCountry: rss.perCountry },
    };
  });

  // Google Play: paralel her property
  const playPromises = (projects ?? []).map(async (p) => {
    const proj = p as ProjectRow;
    const integ = playByProject.get(proj.id);
    if (!integ) return { projectId: proj.id, play: "skip" };
    const cfg = (integ.config ?? {}) as Record<string, unknown>;
    const saJson = typeof cfg.service_account_json === "string" ? cfg.service_account_json : "";
    const pkgName =
      (typeof cfg.package_name === "string" && cfg.package_name) || proj.google_play_id || "";
    if (!saJson || !pkgName) return { projectId: proj.id, play: "skip" };
    const langs = Array.isArray(cfg.language_codes)
      ? (cfg.language_codes as string[])
      : ["en", "tr"];

    const r = await fetchPlayReviews({
      projectId: proj.id,
      packageName: pkgName,
      serviceAccountJson: saJson,
      languageCodes: langs,
    });
    if ("error" in r) {
      return { projectId: proj.id, play: { error: r.error } };
    }
    allRows.push(...r.rows);
    return { projectId: proj.id, play: { count: r.rows.length, pages: r.pages } };
  });

  const [appResults, playResults] = await Promise.all([
    Promise.allSettled(appPromises),
    Promise.allSettled(playPromises),
  ]);
  for (const r of appResults) {
    if (r.status === "fulfilled") results.push(r.value);
    else results.push({ app: { error: String(r.reason) } });
  }
  for (const r of playResults) {
    if (r.status === "fulfilled") results.push(r.value);
    else results.push({ play: { error: String(r.reason) } });
  }

  const upsertResult = await upsertReviews(hub, allRows);
  const elapsedMs = Date.now() - startedAt;

  // Audit log entry - cron run'ı kaydet
  await hub.from("audit_log").insert({
    project_id: null,
    target_user: null,
    action: "system.reviews_ingest",
    detail: JSON.stringify({
      total_rows: allRows.length,
      upserted: upsertResult.ok,
      upsert_errors: upsertResult.errors,
      elapsed_ms: elapsedMs,
      projects: (projects ?? []).length,
    }),
    actor_email: "system",
  });

  return json({
    ok: true,
    projects: (projects ?? []).length,
    reviews: upsertResult.ok,
    elapsed_ms: elapsedMs,
    errors: upsertResult.errors,
    results,
  });
});
```

- [ ] **Step 2: Type check + lint**

Run: `cd supabase/functions && deno check helm-reviews/index.ts`
Expected: hata yok

- [ ] **Step 3: Deploy**

Run: `supabase functions deploy helm-reviews`
Expected: deploy başarılı

- [ ] **Step 4: Manuel invoke testi**

Supabase dashboard veya curl ile:

```bash
curl -X POST 'https://<PROJECT>.functions.supabase.co/helm-reviews' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected JSON yanıtı:
- `ok: true`
- `reviews: N` (>= 0)
- `results: [...]` her property için bir entry, `app.method` ve `play` alanları var
- `errors: []` (boş olmalı)

Eğer ASC key entegre property varsa: `results[*].app.method = "asc"` görmeliyiz.
Eğer key yoksa: `results[*].app.method = "rss"`.

- [ ] **Step 5: DB doğrulama**

```sql
select source, source_method, count(*)
from public.reviews
group by 1, 2
order by 1, 2;
```
Expected: en az `appstore + rss` veya `appstore + asc` satırı. Play entegrasyonu varsa `playstore + play`.

```sql
select * from public.audit_log
where action = 'system.reviews_ingest'
order by created_at desc limit 1;
```
Expected: en son invoke için bir satır; `detail` JSON parse edilebilir.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/helm-reviews/index.ts
git commit -m "feat(helm): WES-000 helm-reviews orchestrator refactor - ASC+RSS hibrit, Google Play, paralel fetch, audit run log"
```

---

## Task 8: Migration 0026 - pg_cron schedule

**Files:**
- Create: `supabase/migrations/0026_reviews_cron.sql`

- [ ] **Step 1: Cron migration yaz**

```sql
-- helm-reviews 30dk cron. Manuel "Yenile" yerine otomatik tazeleme.
-- vault.decrypted_secrets pattern'i 0002_cron.sql ile aynı (helm_project_url + helm_service_role_key).

select cron.schedule(
  'helm-reviews-30m',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'helm_project_url'
    ) || '/functions/v1/helm-reviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'helm_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Job'u kaldırmak için:  select cron.unschedule('helm-reviews-30m');
```

- [ ] **Step 2: Uygula**

Run: `supabase db push`
Expected: 1 satır insert (cron.job_id döner)

- [ ] **Step 3: Cron'un planlandığını doğrula**

```sql
select jobname, schedule, active
from cron.job
where jobname = 'helm-reviews-30m';
```
Expected: 1 satır, `schedule = '*/30 * * * *'`, `active = true`

- [ ] **Step 4: İlk çalıştırmayı bekle (30dk'ya kadar) veya manuel tetikle**

Beklemek istemezsek SQL Editor'da:
```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'helm_project_url')
    || '/functions/v1/helm-reviews',
  headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'helm_service_role_key')),
  body := '{}'::jsonb
);
```

Sonra cron history:
```sql
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'helm-reviews-30m')
order by start_time desc limit 5;
```
Expected: status = `succeeded`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0026_reviews_cron.sql
git commit -m "feat(helm): WES-000 0026 helm-reviews 30dk pg_cron schedule - manuel Yenile artık opsiyonel"
```

---

## Task 9: `helm-review-reply` Edge Function - orchestrator + ASC reply

**Files:**
- Create: `supabase/functions/helm-review-reply/index.ts`
- Create: `supabase/functions/helm-review-reply/asc-reply.ts`

- [ ] **Step 1: ASC reply modülünü yaz**

```typescript
// supabase/functions/helm-review-reply/asc-reply.ts
// Apple App Store Connect Customer Review Responses.
//   POST   /v1/customerReviewResponses             - yeni yanıt
//   PATCH  /v1/customerReviewResponses/{id}        - mevcut yanıtı güncelle
//   GET    /v1/customerReviews/{id}/response       - mevcut response_id'yi öğren

import { makeAscJwt, type ASCKeyConfig } from "../_shared/asc-jwt.ts";

export interface AscReplyInput {
  ascKey: ASCKeyConfig;
  reviewId: string; // Apple review id (external_id'nin son segmenti)
  body: string;
}

export interface AscReplySuccess {
  ok: true;
  respondedAt: string;
}
export interface AscReplyError {
  ok: false;
  status: number;
  message: string;
}

export async function sendAscReply(
  input: AscReplyInput,
): Promise<AscReplySuccess | AscReplyError> {
  let jwt: string;
  try {
    jwt = await makeAscJwt(input.ascKey);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      message: `JWT: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 1. Mevcut response var mı?
  const resCheck = await fetch(
    `https://api.appstoreconnect.apple.com/v1/customerReviews/${input.reviewId}/response`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  let existingId: string | null = null;
  if (resCheck.ok) {
    const data = await resCheck.json();
    existingId = data?.data?.id ?? null;
  } else if (resCheck.status !== 404) {
    return {
      ok: false,
      status: resCheck.status,
      message: `ASC GET response ${resCheck.status}`,
    };
  }

  const url = existingId
    ? `https://api.appstoreconnect.apple.com/v1/customerReviewResponses/${existingId}`
    : `https://api.appstoreconnect.apple.com/v1/customerReviewResponses`;
  const method = existingId ? "PATCH" : "POST";
  const body = existingId
    ? {
        data: {
          type: "customerReviewResponses",
          id: existingId,
          attributes: { responseBody: input.body },
        },
      }
    : {
        data: {
          type: "customerReviewResponses",
          attributes: { responseBody: input.body },
          relationships: {
            review: {
              data: { type: "customerReviews", id: input.reviewId },
            },
          },
        },
      };

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: `ASC ${method} ${res.status}: ${await res.text()}`,
    };
  }
  const data = await res.json();
  const respondedAt =
    data?.data?.attributes?.lastModifiedDate ?? new Date().toISOString();
  return { ok: true, respondedAt };
}
```

- [ ] **Step 2: Play reply modülünü yaz**

`supabase/functions/helm-review-reply/play-reply.ts`:

```typescript
// supabase/functions/helm-review-reply/play-reply.ts
// Google Play androidpublisher.reviews.reply - idempotent (üzerine yazar).

// OAuth helper'ı helm-reviews/play.ts'deki getAccessToken ile aynı.
// DRY: ileri sürümde _shared/play-oauth.ts'ye taşınabilir. Şimdi inline duplicate.

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as ServiceAccount;
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signingInput =
    b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(claim));

  const pem = sa.private_key.replace(/\\n/g, "\n");
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${signingInput}.${sigB64}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(sa.client_email, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

export interface PlayReplyInput {
  serviceAccountJson: string;
  packageName: string;
  reviewId: string;
  body: string;
}

export interface PlayReplySuccess {
  ok: true;
  respondedAt: string;
}
export interface PlayReplyError {
  ok: false;
  status: number;
  message: string;
}

export async function sendPlayReply(
  input: PlayReplyInput,
): Promise<PlayReplySuccess | PlayReplyError> {
  let token: string;
  try {
    token = await getAccessToken(input.serviceAccountJson);
  } catch (e) {
    return { ok: false, status: 500, message: e instanceof Error ? e.message : String(e) };
  }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/reviews/${input.reviewId}:reply`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyText: input.body }),
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: `Play reply ${res.status}: ${await res.text()}`,
    };
  }
  return { ok: true, respondedAt: new Date().toISOString() };
}
```

- [ ] **Step 3: Orchestrator'ı yaz**

`supabase/functions/helm-review-reply/index.ts`:

```typescript
// supabase/functions/helm-review-reply/index.ts
// POST { review_id: number, body: string }
// → JWT'den actor_email çıkar (helm-action pattern)
// → rate limit (60s/10 reply per actor) - audit_log query'si
// → review row → project_id + source + external_id'den vendor review id çıkar
// → ASC veya Play reply API
// → reviews.developer_response + responded_at update
// → audit_log entry (action='review.reply')

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { sendAscReply } from "./asc-reply.ts";
import { sendPlayReply } from "./play-reply.ts";

interface Body {
  review_id?: number;
  body?: string;
}

interface ReviewRow {
  id: number;
  project_id: string;
  source: "appstore" | "playstore";
  external_id: string;
  territory: string | null;
}

const extractVendorReviewId = (externalId: string): string | null => {
  // "asc:us:12345-abc" → "12345-abc"
  // "rss:tr:tag:apple.com,..." → null (RSS yanıtlanamaz)
  // "play:en:gp:AOqpTOH..." → "gp:AOqpTOH..."
  const parts = externalId.split(":");
  if (parts.length < 3) return null;
  if (parts[0] === "rss") return null; // RSS row'larına yanıt yazılamaz
  return parts.slice(2).join(":");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Geçersiz JSON" }, 400);
  }

  const reviewId = body.review_id;
  const replyBody = (body.body ?? "").trim();
  if (!reviewId || typeof reviewId !== "number") {
    return json({ error: "review_id gerekli (number)" }, 400);
  }
  if (replyBody.length === 0) {
    return json({ error: "Yanıt boş olamaz" }, 400);
  }
  if (replyBody.length > 350) {
    return json({ error: "Yanıt 350 karakteri geçemez" }, 422);
  }
  if (/<script|<\/script/i.test(replyBody)) {
    return json({ error: "HTML/script kabul edilmiyor" }, 422);
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Actor email çıkar
  let actorEmail: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    try {
      const { data } = await hub.auth.getUser(jwt);
      actorEmail = data?.user?.email ?? null;
    } catch {
      // anon - actor null kalır
    }
  }
  if (!actorEmail) {
    return json({ error: "Authenticated request gerekli" }, 401);
  }

  // Rate limit: 60s içinde 10 yanıttan fazla yasak
  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: rlErr } = await hub
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_email", actorEmail)
    .eq("action", "review.reply")
    .gte("created_at", sixtySecondsAgo);
  if (rlErr) return json({ error: rlErr.message }, 500);
  if ((recentCount ?? 0) >= 10) {
    return json({ error: "Çok hızlısın, 1 dakika bekle" }, 429);
  }

  // Review'ı çek
  const { data: revRow, error: revErr } = await hub
    .from("reviews")
    .select("id, project_id, source, external_id, territory")
    .eq("id", reviewId)
    .maybeSingle();
  if (revErr) return json({ error: revErr.message }, 500);
  if (!revRow) return json({ error: "Review bulunamadı" }, 404);
  const review = revRow as ReviewRow;

  const vendorReviewId = extractVendorReviewId(review.external_id);
  if (!vendorReviewId) {
    return json(
      { error: "RSS kaynaklı yorumlara yanıt yazılamaz (ASC entegrasyonu gerekli)" },
      422,
    );
  }

  // Entegrasyon config'i çek
  const provider = review.source === "appstore" ? "app_store_connect" : "google_play_developer";
  const { data: integRow, error: integErr } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", review.project_id)
    .eq("provider", provider)
    .eq("enabled", true)
    .maybeSingle();
  if (integErr) return json({ error: integErr.message }, 500);
  if (!integRow) {
    return json(
      { error: `${provider} entegrasyonu yok - Settings → Integrations` },
      401,
    );
  }
  const cfg = (integRow.config ?? {}) as Record<string, string | undefined>;

  // Vendor API çağrısı
  let result: { ok: true; respondedAt: string } | { ok: false; status: number; message: string };
  if (review.source === "appstore") {
    if (!cfg.key_id || !cfg.private_key) {
      return json({ error: "ASC key config eksik" }, 401);
    }
    result = await sendAscReply({
      ascKey: { key_id: cfg.key_id, issuer_id: cfg.issuer_id, private_key: cfg.private_key },
      reviewId: vendorReviewId,
      body: replyBody,
    });
  } else {
    if (!cfg.service_account_json) {
      return json({ error: "Play service account config eksik" }, 401);
    }
    // Package name: integration config'inden veya projects.google_play_id
    let packageName = cfg.package_name ?? "";
    if (!packageName) {
      const { data: proj } = await hub
        .from("projects")
        .select("google_play_id")
        .eq("id", review.project_id)
        .maybeSingle();
      packageName = (proj as { google_play_id?: string } | null)?.google_play_id ?? "";
    }
    if (!packageName) {
      return json({ error: "Play package name bulunamadı" }, 422);
    }
    result = await sendPlayReply({
      serviceAccountJson: cfg.service_account_json,
      packageName,
      reviewId: vendorReviewId,
      body: replyBody,
    });
  }

  if (!result.ok) {
    // Audit log fail entry de yaz
    await hub.from("audit_log").insert({
      project_id: review.project_id,
      target_user: `review:${review.id}`,
      action: "review.reply.fail",
      detail: JSON.stringify({
        source: review.source,
        status: result.status,
        message: result.message,
      }),
      actor_email: actorEmail,
    });
    // 5xx Apple/Google → 502, diğerleri olduğu gibi
    const outStatus =
      result.status >= 500 ? 502 :
      result.status === 401 ? 401 :
      result.status === 429 ? 429 :
      422;
    return json({ error: result.message }, outStatus);
  }

  // DB update
  const { error: upErr } = await hub
    .from("reviews")
    .update({ developer_response: replyBody, responded_at: result.respondedAt })
    .eq("id", review.id);
  if (upErr) return json({ error: upErr.message }, 500);

  // Audit log success
  await hub.from("audit_log").insert({
    project_id: review.project_id,
    target_user: `review:${review.id}`,
    action: "review.reply",
    detail: JSON.stringify({
      source: review.source,
      territory: review.territory,
      body_length: replyBody.length,
    }),
    actor_email: actorEmail,
  });

  return json({ ok: true, responded_at: result.respondedAt });
});
```

- [ ] **Step 4: Type check**

Run: `cd supabase/functions && deno check helm-review-reply/index.ts helm-review-reply/asc-reply.ts helm-review-reply/play-reply.ts`
Expected: hata yok

- [ ] **Step 5: Deploy**

Run: `supabase functions deploy helm-review-reply`

- [ ] **Step 6: Manuel test (anon JWT reddi)**

```bash
curl -X POST 'https://<PROJECT>.functions.supabase.co/helm-review-reply' \
  -H "Content-Type: application/json" \
  -d '{"review_id": 1, "body": "test"}'
```
Expected: 401 `{"error":"Authenticated request gerekli"}`

- [ ] **Step 7: Manuel test (valid JWT, geçersiz review)**

Web tarafından gerçek bir user JWT al, sonra:

```bash
curl -X POST 'https://<PROJECT>.functions.supabase.co/helm-review-reply' \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"review_id": 999999, "body": "test"}'
```
Expected: 404 `{"error":"Review bulunamadı"}`

- [ ] **Step 8: Manuel test (gerçek yanıt - TestFlight veya internal track)**

Apple TestFlight beta review veya Google internal track review'ına gerçek yanıt yaz:

```bash
curl -X POST '...' -H "Authorization: Bearer <JWT>" \
  -d '{"review_id": <gerçek id>, "body": "Geri bildiriminiz için teşekkürler!"}'
```
Expected: 200 `{"ok":true,"responded_at":"2026-..."}`
Sonra App Store Connect veya Play Console'da yanıt görünmeli.

- [ ] **Step 9: Audit log doğrula**

```sql
select action, detail, actor_email, created_at
from public.audit_log
where action like 'review.reply%'
order by created_at desc limit 5;
```
Expected: en az 1 `review.reply` satırı, `detail` JSON parse edilebilir.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/helm-review-reply/
git commit -m "feat(helm): WES-000 helm-review-reply Edge Function - ASC + Play reply, rate limit, audit, RSS reddedilir"
```

---

## Task 10: Web - Review tipi + ReviewsPage stat cards + segment

**Files:**
- Modify: `src/types/index.ts` (veya `src/types/database.ts` - `Review` tipi nerede tanımlıysa)
- Modify: `src/pages/reviews/index.tsx`

- [ ] **Step 1: Review tipini güncelle**

Önce `Review` tipinin yerini bul:

Run: `grep -rn "interface Review\|type Review " src/types/`

Bulunan dosyada şu alanları **ekle** (mevcut alanları silme):

```typescript
export interface Review {
  id: number;
  project_id: string;
  source: "appstore" | "playstore";
  source_method?: "asc" | "rss" | "play" | null;
  external_id?: string | null;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory?: string | null;
  app_version?: string | null;
  developer_response?: string | null;
  responded_at?: string | null;
  review_date: string | null;
  fetched_at?: string;
}
```

- [ ] **Step 2: ReviewsPage'i güncelle - stat cards 5'e çık + platform segment**

`src/pages/reviews/index.tsx` dosyasında üst kısımda (`useList` çağrısından sonra) platform filter state ekle:

```typescript
// useEffect'in üstüne
const [platform, setPlatform] = useState<"all" | "appstore" | "playstore">("all");

// reviews filter - platform da uygulansın
const platformFiltered = useMemo(
  () => (platform === "all" ? reviews : reviews.filter((r) => r.source === platform)),
  [reviews, platform],
);

// avg/distribution platformFiltered üzerinde hesaplansın
const rated = platformFiltered.filter((r) => r.rating != null);
const avg = rated.length
  ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
  : 0;
// distribution aynı şekilde platformFiltered üzerinden

// Source ortalamaları (sabit, platform filtersiz)
const iosRated = reviews.filter((r) => r.source === "appstore" && r.rating != null);
const androidRated = reviews.filter((r) => r.source === "playstore" && r.rating != null);
const iosAvg = iosRated.length
  ? iosRated.reduce((s, r) => s + (r.rating ?? 0), 0) / iosRated.length
  : 0;
const androidAvg = androidRated.length
  ? androidRated.reduce((s, r) => s + (r.rating ?? 0), 0) / androidRated.length
  : 0;
```

Stat satırını `grid-cols-3` → `grid-cols-5` yap:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
  <StatCard title="Genel Ortalama" value={avg ? `${avg.toFixed(2)} / 5` : "-"} icon={<Star />} loading={query.isLoading} />
  <StatCard title="iOS Ortalama" value={iosAvg ? `${iosAvg.toFixed(2)}` : "-"} loading={query.isLoading} />
  <StatCard title="Android Ortalama" value={androidAvg ? `${androidAvg.toFixed(2)}` : "-"} loading={query.isLoading} />
  <StatCard title="Toplam Yorum" value={platformFiltered.length} loading={query.isLoading} />
  <StatCard title="Negatif (1-2★)" value={distribution[0] + distribution[1]} loading={query.isLoading} />
</div>
```

Platform segmented control'ü Card'tan önce ekle (mevcut "Yorumlar" başlığı ve Yenile butonunun altında):

```tsx
<div className="flex gap-1 rounded-md border bg-muted/30 p-1 w-fit">
  {(["all", "appstore", "playstore"] as const).map((p) => (
    <Button
      key={p}
      variant={platform === p ? "default" : "ghost"}
      size="sm"
      onClick={() => setPlatform(p)}
    >
      {p === "all" ? "Tümü" : p === "appstore" ? "iOS" : "Android"}
      <span className="ml-2 text-xs opacity-70">
        {p === "all" ? reviews.length : reviews.filter((r) => r.source === p).length}
      </span>
    </Button>
  ))}
</div>
```

Card başlığı `"Yorumlar (App Store)"` → `"Yorumlar"` olsun.

`filtered` hesaplamasını `platformFiltered`'dan başlat:

```typescript
const filtered = useMemo(() => {
  const needle = q.trim().toLowerCase();
  return platformFiltered.filter((r) => {
    if (ratingFilter !== "all" && r.rating !== Number(ratingFilter)) return false;
    if (needle) {
      const hay = (r.title ?? "").toLowerCase() + " " + (r.body ?? "").toLowerCase() + " " + (r.author ?? "").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}, [platformFiltered, ratingFilter, q]);
```

- [ ] **Step 3: Lokal test**

Run: `bun run dev` (helm web)
Expected: localhost:5173 → /reviews. 5 stat card görünüyor. Platform segment'i iOS/Android tıklayınca filtreliyor. Empty state'de "App Store RSS son 50 yorumu çeker" yerine genel mesaj olsun (sonra iyileştirilebilir).

- [ ] **Step 4: Commit**

```bash
git add src/types/ src/pages/reviews/index.tsx
git commit -m "feat(helm): WES-000 Web reviews - 5 stat card (iOS/Android avg ayrı) + platform segment (Tümü/iOS/Android)"
```

---

## Task 11: Web - ReviewRow badge'leri (source/version/territory)

**Files:**
- Modify: `src/pages/reviews/index.tsx`

- [ ] **Step 1: Yorum satırını revize et**

`pageData.map((r) => ...)` içinde `<div key={r.id} className="py-3 ...">` bloğunu güncelle:

```tsx
{pageData.map((r) => (
  <div key={r.id} className="py-3 first:pt-0 last:pb-0">
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className={starColor(r.rating)}>{stars(r.rating)}</span>
        <span className="font-medium">{r.title ?? ""}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] uppercase">
          {r.source === "appstore" ? "iOS" : "Android"}
        </Badge>
        {r.app_version && (
          <Badge variant="secondary" className="text-[10px] font-mono">
            v{r.app_version}
          </Badge>
        )}
        {r.territory && (
          <Badge variant="secondary" className="text-[10px] uppercase">
            {r.territory}
          </Badge>
        )}
        {isAll && (
          <Badge variant="secondary" className="text-xs">
            {projectName(r.project_id)}
          </Badge>
        )}
      </div>
    </div>
    {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
    <p className="mt-1 text-xs text-muted-foreground">
      {r.author ?? "anonim"} ·{" "}
      {r.review_date ? new Date(r.review_date).toLocaleDateString("tr-TR") : ""}
    </p>
    {/* Reply block - Task 12'de eklenecek */}
  </div>
))}
```

- [ ] **Step 2: Lokal test**

`bun run dev` çalışırken /reviews'ı yenile. iOS/Android badge'leri, version badge (varsa), territory badge (us, tr) görünüyor mu?

- [ ] **Step 3: Commit**

```bash
git add src/pages/reviews/index.tsx
git commit -m "feat(helm): WES-000 Web ReviewRow - source (iOS/Android) + version + territory badge'leri"
```

---

## Task 12: Web - Reply modal + button

**Files:**
- Create: `src/pages/reviews/reply-modal.tsx`
- Modify: `src/pages/reviews/index.tsx`

- [ ] **Step 1: Reply modal komponentini yaz**

```tsx
// src/pages/reviews/reply-modal.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabaseClient } from "@/providers/supabase-client";
import type { Review } from "@/types";

interface Props {
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplied: () => void;
}

const MAX = 350;

export function ReplyModal({ review, open, onOpenChange, onReplied }: Props) {
  const [body, setBody] = useState(review?.developer_response ?? "");
  const [sending, setSending] = useState(false);

  // review değiştiğinde body'i sıfırla (modal yeniden açıldığında)
  // Tek seferlik effect istenirse useEffect; KISS - controlled durumdan kaçınmıyoruz
  if (review && open && body === "" && (review.developer_response ?? "") !== "") {
    setBody(review.developer_response ?? "");
  }

  const handleSubmit = async () => {
    if (!review) return;
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      toast.error("Yanıt boş olamaz");
      return;
    }
    if (trimmed.length > MAX) {
      toast.error(`Yanıt en fazla ${MAX} karakter olmalı`);
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-review-reply",
        { body: { review_id: review.id, body: trimmed } },
      );
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok !== true) {
        throw new Error((data as { error?: string })?.error ?? "Bilinmeyen hata");
      }
      toast.success("Yanıt gönderildi");
      onReplied();
      onOpenChange(false);
      setBody("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Yanıt gönderilemedi", { description: msg });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {review?.developer_response ? "Yanıtı Düzenle" : "Yanıt Yaz"}
          </DialogTitle>
        </DialogHeader>
        {review && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{review.title ?? "-"}</div>
              <div className="mt-1 text-muted-foreground">{review.body ?? "-"}</div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Yanıtınız…"
              rows={4}
              maxLength={MAX}
            />
            <div className="text-right text-xs text-muted-foreground tabular-nums">
              {body.length} / {MAX}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={sending}>
            {sending ? "Gönderiliyor…" : "Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> **Not:** `Textarea` shadcn/ui component'i; eğer eklenmemişse `npx shadcn@latest add textarea` veya `src/components/ui/textarea.tsx`'i manual create et (shadcn standart).

- [ ] **Step 2: ReviewsPage'e reply state + button ekle**

`src/pages/reviews/index.tsx`'in en üstüne import + state:

```typescript
import { ReplyModal } from "./reply-modal";

// state ekle (diğer useState'lerin yanına)
const [replyTarget, setReplyTarget] = useState<Review | null>(null);
```

Yorum satırının altına (badges'in altına) reply block ekle:

```tsx
{r.developer_response ? (
  <div className="mt-2 rounded-md border-l-2 border-emerald-500/60 bg-emerald-500/5 p-2 text-sm">
    <div className="flex items-baseline justify-between">
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
        Yanıt
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setReplyTarget(r)}
      >
        Düzenle
      </Button>
    </div>
    <p className="mt-1">{r.developer_response}</p>
    {r.responded_at && (
      <p className="mt-1 text-xs text-muted-foreground">
        {new Date(r.responded_at).toLocaleString("tr-TR")}
      </p>
    )}
  </div>
) : (
  <div className="mt-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setReplyTarget(r)}
      disabled={r.source_method === "rss"}
      title={r.source_method === "rss" ? "RSS yorumlarına yanıt yazılamaz" : undefined}
    >
      Yanıtla
    </Button>
  </div>
)}
```

Sayfanın en altına (return'ün son `</div>` öncesi) modal ekle:

```tsx
<ReplyModal
  review={replyTarget}
  open={replyTarget !== null}
  onOpenChange={(open) => !open && setReplyTarget(null)}
  onReplied={() => invalidate({ resource: "reviews", invalidates: ["list"] })}
/>
```

- [ ] **Step 3: Lokal test**

`bun run dev` → /reviews → bir yorumda "Yanıtla" tıkla → modal açılıyor → text gir → "Gönder" → toast hata (gerçek API call'a kadar gitmez ama function çağrısı görünür). Network tab'de helm-review-reply isteğini gör.

- [ ] **Step 4: End-to-end test (gerçek review)**

Bir test review için (TestFlight beta veya internal track) yanıt gönder. Toast başarı → modal kapanır → satırda "Yanıt" bloğu görünür.

- [ ] **Step 5: Commit**

```bash
git add src/pages/reviews/reply-modal.tsx src/pages/reviews/index.tsx
git commit -m "feat(helm): WES-000 Web Yanıtla modal - 350 char + senkron submit + toast + RSS satırlarına disable"
```

---

## Task 13: Web - Settings → Google Play Developer kartı

**Files:**
- Create: `src/components/integrations-panel/google-play-developer-card.tsx`
- Modify: integrations-panel sayfasının kart listesi (mevcut yapı `commit 65f1fad`)

- [ ] **Step 1: Mevcut integrations-panel yapısını incele**

Run: `ls src/components/integrations-panel/`

Mevcut bir kart komponentine (örn: `app-store-connect-card.tsx`) bak - yeni kartın aynı patterni izlemesi için.

- [ ] **Step 2: Google Play kartını yaz**

```tsx
// src/components/integrations-panel/google-play-developer-card.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabaseClient } from "@/providers/supabase-client";

interface Props {
  projectId: string;
  existing?: {
    enabled: boolean;
    config: {
      service_account_json?: string;
      package_name?: string;
      language_codes?: string[];
    };
  } | null;
  onSaved: () => void;
}

export function GooglePlayDeveloperCard({ projectId, existing, onSaved }: Props) {
  const [sa, setSa] = useState(existing?.config?.service_account_json ?? "");
  const [pkg, setPkg] = useState(existing?.config?.package_name ?? "");
  const [langs, setLangs] = useState((existing?.config?.language_codes ?? ["en", "tr"]).join(","));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // JSON validation
    try {
      const parsed = JSON.parse(sa);
      if (!parsed.client_email || !parsed.private_key) {
        toast.error("Service account JSON eksik (client_email, private_key gerekli)");
        return;
      }
    } catch {
      toast.error("Service account JSON parse edilemedi");
      return;
    }

    setSaving(true);
    try {
      const langArr = langs.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await supabaseClient
        .from("project_integrations")
        .upsert(
          {
            project_id: projectId,
            provider: "google_play_developer",
            enabled: true,
            config: {
              service_account_json: sa,
              package_name: pkg || null,
              language_codes: langArr,
            },
          },
          { onConflict: "project_id,provider" },
        );
      if (error) throw error;
      toast.success("Google Play Developer entegrasyonu kaydedildi");
      onSaved();
    } catch (e) {
      toast.error("Kaydedilemedi", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Play Developer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Yorumları çekmek (son 7 gün) ve yanıtlamak için. Service account JSON gerekir;
          IAM rolü: <code className="text-xs">androidpublisher</code>.
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gp-sa">Service Account JSON</Label>
          <Textarea
            id="gp-sa"
            rows={6}
            placeholder='{"type":"service_account","client_email":"...","private_key":"..."}'
            value={sa}
            onChange={(e) => setSa(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gp-pkg">Package Name (opsiyonel - boşsa property'den okunur)</Label>
          <Input
            id="gp-pkg"
            placeholder="com.example.app"
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gp-langs">Çeviri dilleri (virgülle)</Label>
          <Input id="gp-langs" value={langs} onChange={(e) => setLangs(e.target.value)} />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Bağla"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Integrations panel'a kartı ekle**

Mevcut kart listesi muhtemelen `src/pages/settings/integrations.tsx` veya benzer bir yerde. Orada kategori "Sağlık/Analitik/..." gruplarından "Sağlık" (App Store ile aynı grup) veya "Yeni: Mobile Stores" altına `<GooglePlayDeveloperCard ... />` ekle. Mevcut grouping pattern'ini değiştirme.

- [ ] **Step 4: Lokal test**

/settings → Integrations'a git. "Google Play Developer" kartı görünüyor mu? Service account JSON yapıştır → "Bağla" → toast başarı → `project_integrations` tablosunda satır oluştu mu?

```sql
select * from public.project_integrations
where provider = 'google_play_developer';
```

- [ ] **Step 5: Commit**

```bash
git add src/components/integrations-panel/google-play-developer-card.tsx src/pages/settings/
git commit -m "feat(helm): WES-000 Web Settings - Google Play Developer entegrasyon kartı (service account JSON + package + languages)"
```

---

## Task 14: Mobil - Review tipi + ReviewRow badge'leri

**Files:**
- Modify: `helm-mobile/src/hooks/use-reviews.ts` (Review tipi)
- Modify: `helm-mobile/src/components/review-row.tsx`

- [ ] **Step 1: Mobil Review tipini güncelle**

`helm-mobile/src/hooks/use-reviews.ts` dosyasında Review tipini bul (büyük olasılıkla orada). Şu alanları ekle:

```typescript
export interface Review {
  id: number;
  project_id: string;
  source: "appstore" | "playstore";
  source_method?: "asc" | "rss" | "play" | null;
  external_id?: string | null;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory?: string | null;
  app_version?: string | null;
  developer_response?: string | null;
  responded_at?: string | null;
  review_date: string | null;
}
```

Hook query'de `select` listesini güncelle (yeni kolonlar dahil):

```typescript
.select("id, project_id, source, source_method, external_id, author, rating, title, body, territory, app_version, developer_response, responded_at, review_date")
```

- [ ] **Step 2: ReviewRow'a badge'ler ekle**

`helm-mobile/src/components/review-row.tsx` dosyasının render'ında source/version/territory badge'lerini ekle. Mevcut layout korunur; badge'ler title yanına row halinde:

```tsx
// Mevcut star + title satırının yanına
<View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
  <View style={{
    backgroundColor: colors.bgHigher,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  }}>
    <Text style={{
      fontFamily: "GeistMono-600",
      fontSize: 9,
      color: colors.fgMuted,
      letterSpacing: 1,
    }}>
      {review.source === "appstore" ? "iOS" : "ANDROID"}
    </Text>
  </View>
  {review.app_version && (
    <View style={{ backgroundColor: colors.bgHigher, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontFamily: "GeistMono-500", fontSize: 9, color: colors.fgMuted }}>
        v{review.app_version}
      </Text>
    </View>
  )}
  {review.territory && (
    <View style={{ backgroundColor: colors.bgHigher, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontFamily: "GeistMono-600", fontSize: 9, color: colors.fgMuted, letterSpacing: 1 }}>
        {review.territory.toUpperCase()}
      </Text>
    </View>
  )}
</View>
```

- [ ] **Step 3: Lokal Expo run**

Run: `cd /Users/canakyuz/Desktop/Projects/priv/helm-mobile && bun expo start` (veya `npx expo start --ios`)
Simulator'da Reviews sekmesini aç. Yorumlarda iOS/ANDROID/version/territory badge'leri görünüyor mu?

- [ ] **Step 4: Commit (helm-mobile repo'sunda)**

```bash
cd /Users/canakyuz/Desktop/Projects/priv/helm-mobile
git add src/hooks/use-reviews.ts src/components/review-row.tsx
git commit -m "feat(mobile): WES-000 ReviewRow badges - source (iOS/ANDROID) + version + territory + yeni Review alanları"
```

---

## Task 15: Mobil - Reply sheet + mutation

**Files:**
- Create: `helm-mobile/src/components/review-reply-sheet.tsx`
- Create: `helm-mobile/src/hooks/use-review-reply.ts`
- Modify: `helm-mobile/app/(cockpit)/(reviews)/index.tsx`
- Modify: `helm-mobile/src/components/review-row.tsx` (yanıt button + yanıt block)

- [ ] **Step 1: Reply mutation hook'unu yaz**

```typescript
// helm-mobile/src/hooks/use-review-reply.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase";
import { toast } from "~/lib/toast";

interface ReplyInput {
  review_id: number;
  body: string;
}

export function useReviewReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ review_id, body }: ReplyInput) => {
      const { data, error } = await supabase.functions.invoke("helm-review-reply", {
        body: { review_id, body },
      });
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok !== true) {
        throw new Error((data as { error?: string })?.error ?? "Bilinmeyen hata");
      }
      return data as { ok: true; responded_at: string };
    },
    onSuccess: () => {
      toast.success("Yanıt gönderildi");
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (e: Error) => {
      toast.error(`Yanıt gönderilemedi: ${e.message}`);
    },
  });
}
```

> **Not:** `~/lib/supabase` ve `~/lib/toast` mevcut. Mutation TanStack Query patterns'ine uyar (mobile'da react-query var, `package.json` doğrula).

- [ ] **Step 2: Reply sheet component'i**

```tsx
// helm-mobile/src/components/review-reply-sheet.tsx
import { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "~/theme/tokens";
import { useReviewReply } from "~/hooks/use-review-reply";
import type { Review } from "~/hooks/use-reviews";

interface Props {
  review: Review | null;
  visible: boolean;
  onClose: () => void;
}

const MAX = 350;

export function ReviewReplySheet({ review, visible, onClose }: Props) {
  const [body, setBody] = useState("");
  const mutation = useReviewReply();

  useEffect(() => {
    if (visible) setBody(review?.developer_response ?? "");
  }, [visible, review]);

  const handleSubmit = () => {
    if (!review) return;
    const trimmed = body.trim();
    if (trimmed.length === 0 || trimmed.length > MAX) return;
    mutation.mutate(
      { review_id: review.id, body: trimmed },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
      >
        <SafeAreaView style={{ backgroundColor: colors.bgElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} edges={["bottom"]}>
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: "Geist-600", fontSize: 16, color: colors.fgPrimary }}>
                {review?.developer_response ? "Yanıtı Düzenle" : "Yanıt Yaz"}
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={{ color: colors.fgMuted, fontSize: 14 }}>İptal</Text>
              </Pressable>
            </View>
            {review && (
              <View style={{ backgroundColor: colors.bgHigher, padding: 10, borderRadius: 8 }}>
                <Text style={{ fontFamily: "Geist-500", color: colors.fgPrimary, fontSize: 13 }}>
                  {review.title ?? "-"}
                </Text>
                <Text style={{ color: colors.fgMuted, fontSize: 12, marginTop: 4 }} numberOfLines={3}>
                  {review.body ?? "-"}
                </Text>
              </View>
            )}
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={MAX}
              placeholder="Yanıtınız…"
              placeholderTextColor={colors.fgSubtle}
              style={{
                minHeight: 100,
                backgroundColor: colors.bgBase,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                color: colors.fgPrimary,
                fontFamily: "Geist-400",
                fontSize: 14,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: "GeistMono-500", fontSize: 11, color: colors.fgMuted }}>
                {body.length} / {MAX}
              </Text>
              <Pressable
                onPress={handleSubmit}
                disabled={mutation.isPending || body.trim().length === 0}
                style={{
                  backgroundColor: mutation.isPending || body.trim().length === 0 ? colors.bgHigher : colors.accent,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: colors.bgBase, fontFamily: "Geist-600", fontSize: 14 }}>
                  {mutation.isPending ? "Gönderiliyor…" : "Gönder"}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 3: ReviewRow'a reply button + yanıt block ekle**

`helm-mobile/src/components/review-row.tsx` dosyasında:

```tsx
// Mevcut review-row'un en altına (tarih/author satırından sonra)
{review.developer_response ? (
  <View style={{
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: 10,
    paddingVertical: 6,
    backgroundColor: `${colors.accent}10`,
    borderRadius: 6,
  }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ fontFamily: "GeistMono-600", fontSize: 9, letterSpacing: 1, color: colors.accent }}>
        YANIT
      </Text>
      <Pressable onPress={() => onReply?.(review)} hitSlop={6}>
        <Text style={{ fontFamily: "GeistMono-500", fontSize: 10, color: colors.accentInfo }}>
          DÜZENLE
        </Text>
      </Pressable>
    </View>
    <Text style={{ fontFamily: "Geist-400", fontSize: 13, color: colors.fgPrimary, marginTop: 4 }}>
      {review.developer_response}
    </Text>
  </View>
) : review.source_method !== "rss" ? (
  <Pressable
    onPress={() => onReply?.(review)}
    style={{
      marginTop: 8,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignSelf: "flex-start",
    }}
    hitSlop={4}
  >
    <Text style={{ fontFamily: "Geist-500", fontSize: 12, color: colors.fgPrimary }}>
      Yanıtla
    </Text>
  </Pressable>
) : null}
```

`onReply` prop'u ReviewRow Props interface'e ekle:

```typescript
interface Props {
  review: Review;
  onReply?: (review: Review) => void;
}
```

- [ ] **Step 4: Reviews ekranında sheet'i kullan**

`helm-mobile/app/(cockpit)/(reviews)/index.tsx` dosyasında üst kısma state + sheet ekle:

```tsx
import { ReviewReplySheet } from "~/components/review-reply-sheet";
// ...

const [replyTarget, setReplyTarget] = useState<Review | null>(null);

// ReviewRow'a onReply prop'unu ver
<ReviewRow key={...} review={review} onReply={setReplyTarget} />

// JSX sonunda:
<ReviewReplySheet
  review={replyTarget}
  visible={replyTarget !== null}
  onClose={() => setReplyTarget(null)}
/>
```

`Review` tipini import et: `import type { Review } from "~/hooks/use-reviews";`

- [ ] **Step 5: Hero card platform-aware avg**

Mevcut hero card `data.average` kullanıyor. `useReviews` hook'u zaten `platform` filter'ı alıyor - sadece hero'daki ortalama platform'a göre değişecek. Mevcut platform state ile zaten bu çalışmalı; doğrula:

`useReviews(platform, rating)` çağrısı varsa `data.average` zaten platform-filtered olmalı. Eğer hook'ta global avg dönüyorsa düzelt: platform filter'ı applikasyonu içine al.

`helm-mobile/src/hooks/use-reviews.ts` içine bak - eğer avg hook içinde hesaplanıyorsa source filter'ı uygula. Bu zaten doğru olabilir; doğrulamak için Reviews ekranını aç, segment'i iOS → Android olarak değiştir → "ORTALAMA" sayısı değişiyor mu?

- [ ] **Step 6: End-to-end test**

Simulator'da → Reviews → bir yorumda "Yanıtla" tıkla → sheet aç → text gir → "Gönder" → toast başarı → yorum altında yanıt block görünür.

- [ ] **Step 7: Commit**

```bash
cd /Users/canakyuz/Desktop/Projects/priv/helm-mobile
git add src/components/review-reply-sheet.tsx src/components/review-row.tsx src/hooks/use-review-reply.ts app/\(cockpit\)/\(reviews\)/index.tsx src/hooks/use-reviews.ts
git commit -m "feat(mobile): WES-000 Reviews - Yanıtla sheet + reply mutation + yanıt block + RSS reddedilir"
```

---

## Task 16: End-to-end manuel verifikasyon

- [ ] **Step 1: Tam akış testi**

Hem web hem mobil aynı anda açık. Yeni bir review (TestFlight beta + Play internal track) gelmesini tetikle veya mevcut bir review'a yanıt yaz.

- [ ] **Step 2: Cron çalışmasını doğrula**

30dk bekle veya manuel tetikle. `cron.job_run_details`'te `succeeded` görmeli, `audit_log`'da `system.reviews_ingest` entry'si bulunmalı.

- [ ] **Step 3: Hibrit fallback testi**

ASC key'in role'ünü Apple Developer Portal'da geçici olarak Customer Reviews'tan çıkar (veya entegrasyonu `enabled=false` yap). 30dk cron tekrar çalıştığında o property RSS'e düşmeli (`results[*].app.method = "rss"`). DB'de yeni RSS satırları source_method='rss' olarak gelmeli.

- [ ] **Step 4: Rate limit testi**

Web'de art arda 11 yanıt yaz (kısa, valid). 11.'sinde "Çok hızlısın, 1 dakika bekle" toast'u görmeli.

- [ ] **Step 5: Final commit (varsa README/docs)**

Eğer README veya CHANGELOG güncellemesi gerekirse:

```bash
# helm web
cd /Users/canakyuz/Desktop/Projects/priv/helm
# Eğer BACKLOG.md'de "Reviews entegrasyon" entry'si varsa "done" işaretle veya kaldır
git add BACKLOG.md
git commit -m "docs(helm): WES-000 Reviews entegrasyon onarımı tamamlandı - backlog güncellendi"
```

---

## Spec Coverage Review

| Spec bölümü | Karşılayan task(lar) |
|---|---|
| 2. Karar Özeti - Hibrit ASC+RSS | Task 4, 5, 7 |
| 2. Karar Özeti - Google Play API | Task 6, 7 |
| 2. Karar Özeti - 30dk cron | Task 8 |
| 2. Karar Özeti - Web+mobil yanıtlama | Task 9, 12, 15 |
| 3. Mimari | Task 4-9 |
| 4.1 Schema değişiklikleri | Task 1 |
| 4.2 Google Play provider | Task 13 |
| 4.3 audit_log review.reply | Task 9 (orchestrator) |
| 5. Edge function helm-reviews | Task 4, 5, 6, 7 |
| 6. helm-review-reply | Task 9 |
| 7.1 Web UI | Task 10, 11, 12, 13 |
| 7.2 Mobil UI | Task 14, 15 |
| 8. Migration sırası | Task 1, 2, 8 |
| 9. Deploy sırası | Task 3, 7, 9 (deploy step'leri) |
| 10. Test stratejisi | Her task'in verify step'leri + Task 16 |
| 12. Risk önlemleri | Task 7 (fallback), Task 9 (rate limit) |
| 13. Scope dışı | Yanıt silme & B/C/D plan dışı |
| 14. Açık sorular | (1) modal - Task 12; (2) Modal RN - Task 15; (3) ["en","tr"] default - Task 6 |

**Eksik / dikkat:** Spec'te bahsedilen `cron_runs` tablosu hiç oluşturulmuyor; yerine `audit_log`'a yazılıyor (plan ⚠️ bölümünde açıklandı).

---

## Notlar

- **DRY:** Google OAuth helper Task 6 (play.ts) ve Task 9 (play-reply.ts) arasında duplicate. Spec'te tek bir refactor önerilebilir (`_shared/play-oauth.ts`); şimdi duplicate edip ileride extract etmek YAGNI uyumlu. Bu plan'da duplicate kabul.
- **Migration numarası**: Eğer bu plan execute edilirken yeni bir migration daha varsa (örn: başka feature 0028 ekledi), numaraları offset'e dikkat.
- **EAS update**: Mobil değişiklikler için `eas update --branch production` ile OTA gönderilebilir (native değişiklik yok).
- **CLAUDE.md uyum**: Unit test yok, gerçek DB testleri var. Commit format `type(scope): WES-XXX message` tek satır.
