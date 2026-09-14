# Zernio Alt Proje 1: Temel + Analitik - Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zernio'yu Helm'e bir sağlayıcı olarak bağla; hesaplar ve günlük sosyal metrikler nightly ingest ile aksın, web ve mobilde "Sosyal" genel bakışı görünsün, webhook altyapısı (imza doğrulama, hesap olayları) ayakta olsun.

**Architecture:** Mevcut connector kalıbına (`helm-ingest`) yeni bir `zernio` connector eklenir; connector metrik noktalarını `metrics`'e, hesap ve hesap×gün satırlarını yeni `extra` upsert kanalıyla `social_accounts` / `social_account_daily`'ye yazar. Yeni iki edge function: `helm-social` (kullanıcı JWT ile hesap senkronu + webhook aboneliği) ve `helm-zernio-webhook` (HMAC doğrulamalı gelen olaylar). Paylaşılan katman (`@helm/api`, `@helm/queries`) hem web hem mobil tarafından okunur.

**Tech Stack:** Supabase (Postgres + Edge Functions/Deno), Bun workspaces, TypeScript strict, React 19 + Refine + Recharts (web), Expo SDK 56 + expo-router NativeTabs (mobil), TanStack Query, `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-14-zernio-social-integration-design.md`

## Global Constraints

- Commit formatı: `type(scope): WES-000 mesaj` tek satır, Co-Authored-By yok, `--no-verify` yok (CLAUDE.md §0). Scope: `db`, `ingest`, `functions`, `domain`, `api`, `queries`, `web`, `mobile`, `root`.
- Mock/test verisi yok: doğrulama gerçek Zernio hesabı ve gerçek Supabase ile yapılır. Unit testler yalnızca saf fonksiyonlar için (toplama, imza, özet).
- API key client'a inmez; yalnızca edge function `project_integrations.config.api_key` okur. Loglara key ve mesaj gövdesi yazılmaz.
- Edge function'larda `deno` yerel kurulu değil; saf modüller Deno API'si kullanmaz ve `bun test` ile test edilir. Deno'ya özgü kod (`Deno.env`, `Deno.serve`) yalnızca `index.ts` ve `_shared/*.ts` içinde kalır; `_shared/zernio-signature.ts` Web Crypto kullanır (bun'da da var).
- Zernio base URL `https://zernio.com/api/v1`, header `Authorization: Bearer sk_…`.
- `metrics.source = 'zernio'`, metrik adları: `social_followers`, `social_impressions`, `social_reach`, `social_engagements`, `social_posts_published`. Hiçbiri `MONEY_METRICS`'e girmez.
- Webhook secret env adı: `ZERNIO_WEBHOOK_SECRET`. Yoksa webhook 500 döner, "dev modu" yok.
- Migration numarası bu alt proje için `0051`. Spec tek migration diyordu; alt projeler bağımsız yayına çıksın diye `social_posts` (0052, alt proje 2) ve `social_inbox_events` (0053, alt proje 3) kendi migration'larını alır.
- Mobilde sosyal yığını `app/(cockpit)/settings/social/` altında yaşar (yol `/settings/social`). Neden: kök layout `Slot`, kök Stack yok; NativeTabs altında sekmesiz rota davranışı bu repoda kanıtlanmamış, Ayarlar altındaki iç yığın (`settings/sources/*`) kanıtlı. Overview karosu bu yola push eder.

## Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `supabase/migrations/0051_zernio_provider.sql` | provider check + `social_accounts` + `social_account_daily` + RLS |
| `packages/domain/src/integrations.ts` | `zernio` sağlayıcı kaydı ve form alanları (mobil formun kaynağı) |
| `packages/domain/src/integrations.test.ts` | sağlayıcı kaydı regresyonu |
| `apps/web/src/types/index.ts` | web `ProviderName` + `PROVIDER_LABELS` kopyası |
| `apps/web/src/components/integrations-panel/index.tsx` | web form alanları kopyası + kayıt sonrası `helm-social` çağrısı |
| `apps/web/src/lib/integrations.ts` | `PROVIDER_META.zernio` |
| `apps/web/src/lib/modules.ts` | `social` modülü canlı, `SOURCE_TO_MODULE.zernio` |
| `packages/api/src/data-coverage.ts` | `EXPECTED_LAG.zernio` |
| `supabase/functions/_shared/zernio.ts` | Zernio HTTP istemcisi + tipler + profil/hesap/analitik çağrıları |
| `supabase/functions/helm-ingest/connectors/types.ts` | `ExtraUpsert` + `daysAgo` |
| `supabase/functions/helm-ingest/connectors/zernio-aggregate.ts` | saf toplama (test edilir) |
| `supabase/functions/helm-ingest/connectors/zernio-aggregate.test.ts` | toplama testleri |
| `supabase/functions/helm-ingest/connectors/zernio.ts` | connector |
| `supabase/functions/helm-ingest/index.ts` | `extra` upsert desteği + `provider` filtresi + kayıt |
| `supabase/functions/helm-test/index.ts`, `helm-verify/index.ts` | kayıt + nesne dönüşü normalize |
| `supabase/functions/_shared/expo-push.ts` | cockpit push (helm-alert'ten taşınır) |
| `supabase/functions/helm-alert/index.ts` | paylaşılan push'u kullanır |
| `supabase/functions/_shared/zernio-signature.ts` | HMAC doğrulama (saf) |
| `supabase/functions/_shared/zernio-signature.test.ts` | imza testleri |
| `supabase/functions/helm-zernio-webhook/index.ts` | gelen olaylar |
| `supabase/functions/helm-social/index.ts` | `accounts.sync`, `webhook.ensure` |
| `packages/api/src/social.ts` (+ `.test.ts`) | satır tipleri, fetch'ler, `summarizeSocialKpis`, `invokeSocial` |
| `packages/queries/src/social.ts` | key factory + queryOptions |
| `apps/web/src/hooks/use-social.ts`, `apps/web/src/pages/social/index.tsx` | web sayfası |
| `apps/web/src/App.tsx`, `apps/web/src/components/layout/index.tsx` | route + sidebar |
| `apps/mobile/src/hooks/use-social.ts` | mobil hook'lar |
| `apps/mobile/app/(cockpit)/settings/social/_layout.tsx`, `index.tsx` | mobil ekran |
| `apps/mobile/app/(cockpit)/settings/index.tsx`, `overview.tsx` | giriş noktaları |
| `docs/integrations/providers.md` | Zernio bölümü |

---

### Task 1: Migration - sağlayıcı ve sosyal tablolar

**Files:**
- Create: `supabase/migrations/0051_zernio_provider.sql`

**Interfaces:**
- Produces: tablolar `public.social_accounts (id text pk, project_id uuid, platform, username, display_name, avatar_url, profile_url, followers_count int, is_active bool, needs_reconnection bool, synced_at, created_at)` ve `public.social_account_daily (account_id text, date date, followers int null, impressions int, reach int, engagements int; pk (account_id, date))`; `project_integrations.provider` artık `'zernio'` kabul eder.

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- Zernio sosyal medya saglayicisi - hesaplar + hesap x gun metrikleri.
--
-- NEDEN AYRI TABLO: takipci/impression/engagement toplamlari `metrics`'e gider
-- (KPI, uyari, kapsam ayni yoldan calissin diye). Ama "hangi hesap, hangi
-- platform, kac takipci" bilgisi metrics'in (project, date, source, metric)
-- anahtarina sigmaz. Hesap listesi kucuk ve gecikmesiz; hesap x gun kirilimi
-- platform grafigi icin. Gelen webhook olaylari da projeye buradaki
-- account_id -> project_id koprusuyle baglanir (RevenueCat'teki "tek
-- entegrasyonu sec" kisayolu yerine).

alter table public.project_integrations
  drop constraint if exists project_integrations_provider_check;

alter table public.project_integrations
  add constraint project_integrations_provider_check
  check (
    provider in (
      'revenuecat', 'admob', 'posthog', 'supabase',
      'stripe', 'plausible', 'rest', 'sentry',
      'app_store_connect', 'resend', 'google_play_developer',
      'zernio'
    )
  );

create table if not exists public.social_accounts (
  -- Zernio account _id (24 hex). Upsert anahtari; ayni hesap iki kez yazilmaz.
  id text primary key,
  project_id uuid not null references public.properties(id) on delete cascade,
  platform text not null,
  username text,
  display_name text,
  avatar_url text,
  profile_url text,
  -- Zernio yalnizca analytics eklentisiyle verir; yoksa null (0 degil).
  followers_count integer,
  is_active boolean not null default true,
  -- Platform token'i oldu; kullanici Zernio'da yeniden baglamali.
  needs_reconnection boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_social_accounts_project
  on public.social_accounts (project_id);

alter table public.social_accounts enable row level security;

drop policy if exists "authenticated read social_accounts" on public.social_accounts;
create policy "authenticated read social_accounts" on public.social_accounts
  for select to authenticated using (true);

-- Yazma YALNIZCA service role (helm-ingest, helm-social, helm-zernio-webhook).

create table if not exists public.social_account_daily (
  account_id text not null references public.social_accounts(id) on delete cascade,
  date date not null,
  -- Gunun sonundaki anlik takipci sayisi; o gun olculmediyse null.
  followers integer,
  impressions integer not null default 0,
  reach integer not null default 0,
  -- likes + comments + shares + saves
  engagements integer not null default 0,
  primary key (account_id, date)
);

alter table public.social_account_daily enable row level security;

drop policy if exists "authenticated read social_account_daily" on public.social_account_daily;
create policy "authenticated read social_account_daily" on public.social_account_daily
  for select to authenticated using (true);

comment on table public.social_accounts is
  'Zernio uzerinden bagli sosyal hesaplar - proje koprusu ve anlik takipci sayisi.';
comment on table public.social_account_daily is
  'Hesap x gun sosyal metrikleri. Toplamlar metrics tablosunda (source=zernio).';
```

- [ ] **Step 2: Migration'ı uygula**

Run: `make db-push`
Expected: `0051_zernio_provider.sql` uygulandı, hata yok.

- [ ] **Step 3: Şemayı doğrula**

Run: `make gen-types && grep -c "social_accounts\|social_account_daily" packages/types/src/database.ts`
Expected: sayı ≥ 2 (iki tablo `Database` tipinde).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0051_zernio_provider.sql packages/types/src/database.ts
git commit -m "feat(db): WES-000 zernio saglayicisi ve sosyal hesap tablolarini ekle"
```

---

### Task 2: `@helm/domain` - zernio sağlayıcı kaydı

**Files:**
- Modify: `packages/domain/src/integrations.ts:16-45` (`PROVIDERS`, `PROVIDER_LABEL`) ve `:59-252` (`PROVIDER_FIELDS`)
- Test: `packages/domain/src/integrations.test.ts`

**Interfaces:**
- Produces: `ProviderName` artık `"zernio"` içerir; `PROVIDER_FIELDS.zernio = [api_key (secret), profile_id (optional)]`; `isSecretKey("zernio","api_key") === true`.

- [ ] **Step 1: Başarısız testi yaz**

```ts
// packages/domain/src/integrations.test.ts
import { describe, expect, it } from "bun:test";
import { PROVIDERS, PROVIDER_FIELDS, PROVIDER_LABEL, isSecretKey, providerLabel } from "./integrations";

// Saglayici listesi DB check constraint'i ile birebir olmali (0051). Eksik
// kayit ekranda ham kimlik olarak cikar - bu dosyanin basindaki olay.
describe("zernio saglayicisi", () => {
  it("PROVIDERS listesinde ve etiketi var", () => {
    expect(PROVIDERS).toContain("zernio");
    expect(PROVIDER_LABEL.zernio).toBe("Zernio");
    expect(providerLabel("zernio")).toBe("Zernio");
  });

  it("api_key sir, profile_id istege bagli", () => {
    const keys = PROVIDER_FIELDS.zernio.map((f) => f.key);
    expect(keys).toEqual(["api_key", "profile_id"]);
    expect(isSecretKey("zernio", "api_key")).toBe(true);
    expect(isSecretKey("zernio", "profile_id")).toBe(false);
    expect(PROVIDER_FIELDS.zernio.find((f) => f.key === "profile_id")?.optional).toBe(true);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `bun test packages/domain/src/integrations.test.ts`
Expected: FAIL - `expect(PROVIDERS).toContain("zernio")`.

- [ ] **Step 3: Kaydı ekle**

`PROVIDERS` dizisinin sonuna (`"google_play_developer",` satırından sonra):

```ts
  "zernio",
```

`PROVIDER_LABEL` nesnesine:

```ts
  zernio: "Zernio",
```

`PROVIDER_FIELDS` nesnesinin sonuna (`google_play_developer: [...]` bloğundan sonra, kapanış `};` öncesi):

```ts
  zernio: [
    {
      key: "api_key",
      label: "Zernio API Key (sk_ ile baslar)",
      secret: true,
      placeholder: "sk_…",
    },
    {
      key: "profile_id",
      label: "Zernio Profile ID (bos ise varsayilan profil kullanilir)",
      placeholder: "24 karakter hex",
      optional: true,
    },
  ],
```

- [ ] **Step 4: Test ve typecheck**

Run: `bun test packages/domain/src/integrations.test.ts && bun run --cwd packages/domain typecheck`
Expected: PASS, tsc hata yok.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/integrations.ts packages/domain/src/integrations.test.ts
git commit -m "feat(domain): WES-000 zernio saglayici kaydi ve form alanlari"
```

---

### Task 3: Web sağlayıcı kopyaları ve modül

**Files:**
- Modify: `apps/web/src/types/index.ts:5-16` (`ProviderName`), `:222-234` (`PROVIDER_LABELS`)
- Modify: `apps/web/src/components/integrations-panel/index.tsx:93-299` (`PROVIDER_FIELDS`)
- Modify: `apps/web/src/lib/integrations.ts:21-87` (`PROVIDER_META`)
- Modify: `apps/web/src/lib/modules.ts:112-117` (`social`), `:122-135` (`SOURCE_TO_MODULE`)
- Modify: `packages/api/src/data-coverage.ts:35-45` (`EXPECTED_LAG`)

**Interfaces:**
- Produces: web tarafında `"zernio"` geçerli `ProviderName`; sidebar `requires: "social"` artık seçilebilir modül.

- [ ] **Step 1: `ProviderName` ve etiket**

`apps/web/src/types/index.ts` içinde union'a `| "google_play_developer"` satırından sonra:

```ts
  | "zernio";
```

(önceki satırın sonundaki `;` kaldırılır). `PROVIDER_LABELS`'a:

```ts
  zernio: "Zernio (Sosyal)",
```

- [ ] **Step 2: Panel form alanları**

`integrations-panel/index.tsx` `PROVIDER_FIELDS` nesnesinin sonuna, `google_play_developer` bloğunun kapanış `],` satırından sonra:

```tsx
  zernio: [
    {
      key: "api_key",
      label: "Zernio API Key (Zernio → Settings → API Keys, sk_ ile başlar)",
      secret: true,
      placeholder: "sk_…",
    },
    {
      key: "profile_id",
      label: "Zernio Profile ID (boşsa varsayılan profil - hesaplar bu profilden okunur)",
      placeholder: "24 karakter hex",
      optional: true,
    },
  ],
```

- [ ] **Step 3: Taksonomi**

`apps/web/src/lib/integrations.ts` `PROVIDER_META` sonuna:

```ts
  zernio: {
    category: "communication",
    icon: "Share2",
    description: "Sosyal hesaplar · takipçi · etkileşim · yayın · inbox",
    docs: "https://docs.zernio.com",
  },
```

- [ ] **Step 4: Modül canlı**

`apps/web/src/lib/modules.ts` `social` girdisini şu hale getir (`comingSoon` satırı silinir):

```ts
  social: {
    label: "Sosyal",
    icon: "Share2",
    description: "Sosyal hesaplar, takipçi ve etkileşim (Zernio).",
  },
```

`SOURCE_TO_MODULE`'a:

```ts
  zernio: "social",
```

- [ ] **Step 5: Beklenen gecikme**

`packages/api/src/data-coverage.ts` `EXPECTED_LAG` nesnesine:

```ts
  zernio: 0,
```

- [ ] **Step 6: Typecheck**

Run: `make typecheck`
Expected: hata yok. `Record<ProviderName, …>` tipleri eksik anahtar bırakmaz; eksik varsa tsc söyler.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/types/index.ts apps/web/src/components/integrations-panel/index.tsx apps/web/src/lib/integrations.ts apps/web/src/lib/modules.ts packages/api/src/data-coverage.ts
git commit -m "feat(web): WES-000 zernio saglayicisini panele ve sosyal modulune bagla"
```

---

### Task 4: Zernio istemcisi ve saf toplama

**Files:**
- Create: `supabase/functions/_shared/zernio.ts`
- Modify: `supabase/functions/helm-ingest/connectors/types.ts`
- Create: `supabase/functions/helm-ingest/connectors/zernio-aggregate.ts`
- Test: `supabase/functions/helm-ingest/connectors/zernio-aggregate.test.ts`

**Interfaces:**
- Produces (`_shared/zernio.ts`): `zernioFetch<T>(apiKey, path, init?)`, `class ZernioApiError { status, code, retryAfter }`, `resolveProfileId(apiKey, configured?)`, `listAccounts(apiKey, profileId)`, `listAnalyticsPosts(apiKey, profileId, fromDate, toDate)`, tipler `ZernioAccount`, `ZernioAnalyticsPost`, `ZernioPostAnalytics`.
- Produces (`types.ts`): `ExtraUpsert { table; rows; onConflict; withProjectId }`, `ConnectorResult` nesne biçiminde `extra?: ExtraUpsert[]`, `daysAgo(n)`.
- Produces (`zernio-aggregate.ts`): `toAccountRows(accounts, syncedAt): SocialAccountRow[]`, `aggregateDaily(accounts, posts, today): { points: MetricPoint[]; daily: SocialAccountDailyRow[] }`.

- [ ] **Step 1: Connector tiplerini genişlet**

`types.ts` içinde `ConnectorResult` tanımını şu hale getir ve `daysAgo` ekle:

```ts
/**
 * Connector'in metrics disinda yazmak istedigi satirlar. helm-ingest sirayla
 * upsert eder; `withProjectId` true ise her satira `project_id` enjekte edilir
 * (connector projeyi bilmez, yalnizca config alir).
 */
export interface ExtraUpsert {
  table: string;
  rows: Record<string, unknown>[];
  onConflict: string;
  withProjectId: boolean;
}

/** Geriye uyumlu connector çıktısı: düz dizi veya {points, byCountry, byFormat, extra}. */
export type ConnectorResult =
  | MetricPoint[]
  | {
      points: MetricPoint[];
      byCountry?: CountryMetricPoint[];
      byFormat?: FormatMetricPoint[];
      extra?: ExtraUpsert[];
    };
```

Dosya sonuna:

```ts
/** n gün önceki UTC tarihi (YYYY-MM-DD). */
export const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
```

- [ ] **Step 2: Zernio istemcisi**

```ts
// supabase/functions/_shared/zernio.ts
// Zernio API istemcisi - tek giris noktasi. Key'i alir, hatayi Zernio'nun
// {error,type,code} govdesinden okur. Loglara key yazilmaz.

export const ZERNIO_BASE = "https://zernio.com/api/v1";

interface ZernioErrorBody {
  error?: string;
  type?: string;
  code?: string;
}

export class ZernioApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export async function zernioFetch<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.ok) return (await res.json()) as T;
  const text = await res.text();
  let parsed: ZernioErrorBody | null = null;
  try {
    parsed = JSON.parse(text) as ZernioErrorBody;
  } catch {
    // duz metin hata
  }
  const retryAfter = Number(res.headers.get("retry-after")) || undefined;
  throw new ZernioApiError(
    res.status,
    parsed?.code,
    `Zernio ${res.status}: ${parsed?.error ?? text.slice(0, 200)}`,
    retryAfter,
  );
}

export interface ZernioProfile {
  _id: string;
  name: string;
  isDefault?: boolean;
}

export interface ZernioAccount {
  _id: string;
  platform: string;
  /** Spec'te tip belirsiz: duz id ya da populate edilmis {_id}. */
  profileId?: string | { _id: string } | null;
  username?: string | null;
  displayName?: string | null;
  profilePicture?: string | null;
  profileUrl?: string | null;
  isActive?: boolean;
  needsReconnection?: boolean;
  /** Yalnizca analytics eklentisiyle gelir. */
  followersCount?: number | null;
  enabled?: boolean;
}

export interface ZernioPostAnalytics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  views?: number;
}

export interface ZernioAnalyticsPost {
  _id: string;
  status: string;
  publishedAt: string | null;
  analytics?: ZernioPostAnalytics | null;
  platformAnalytics?: Array<{
    platform: string;
    accountId: string;
    analytics?: ZernioPostAnalytics | null;
  }>;
}

export function profileIdOf(account: ZernioAccount): string | null {
  const p = account.profileId;
  if (!p) return null;
  return typeof p === "string" ? p : p._id;
}

/** config.profile_id bossa isDefault profil, o da yoksa ilk profil. */
export async function resolveProfileId(
  apiKey: string,
  configured?: string,
): Promise<string> {
  if (configured && configured.trim()) return configured.trim();
  const { profiles } = await zernioFetch<{ profiles: ZernioProfile[] }>(
    apiKey,
    "/profiles",
  );
  const chosen = profiles.find((p) => p.isDefault) ?? profiles[0];
  if (!chosen) throw new Error("Zernio: hesapta hic profil yok");
  return chosen._id;
}

export async function listAccounts(
  apiKey: string,
  profileId: string,
): Promise<ZernioAccount[]> {
  const { accounts } = await zernioFetch<{ accounts: ZernioAccount[] }>(
    apiKey,
    "/accounts",
  );
  return accounts.filter((a) => profileIdOf(a) === profileId);
}

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

/** Post analitigi - sayfalari sonuna kadar gezer. O(P) istek sayisi P/50. */
export async function listAnalyticsPosts(
  apiKey: string,
  profileId: string,
  fromDate: string,
  toDate: string,
): Promise<ZernioAnalyticsPost[]> {
  const out: ZernioAnalyticsPost[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      profileId,
      fromDate,
      toDate,
      limit: String(PAGE_SIZE),
      page: String(page),
    });
    const { posts } = await zernioFetch<{ posts?: ZernioAnalyticsPost[] }>(
      apiKey,
      `/analytics?${qs.toString()}`,
    );
    const batch = posts ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}
```

- [ ] **Step 3: Başarısız toplama testini yaz**

```ts
// supabase/functions/helm-ingest/connectors/zernio-aggregate.test.ts
import { describe, expect, it } from "bun:test";
import { aggregateDaily, toAccountRows } from "./zernio-aggregate";
import type { ZernioAccount, ZernioAnalyticsPost } from "../../_shared/zernio";

const accounts: ZernioAccount[] = [
  { _id: "acc1", platform: "instagram", username: "brand_main", followersCount: 120, isActive: true },
  { _id: "acc2", platform: "tiktok", username: "brand_studio", followersCount: null, isActive: true },
  { _id: "acc3", platform: "youtube", username: "old", followersCount: 9, isActive: false },
];

const posts: ZernioAnalyticsPost[] = [
  {
    _id: "p1",
    status: "published",
    publishedAt: "2026-09-10T22:06:41.000Z",
    analytics: { impressions: 100, reach: 80, likes: 5, comments: 1, shares: 2, saves: 2 },
    platformAnalytics: [
      { platform: "instagram", accountId: "acc1", analytics: { impressions: 60, reach: 50, likes: 3, comments: 1, shares: 1, saves: 1 } },
      { platform: "tiktok", accountId: "acc2", analytics: { impressions: 40, reach: 30, likes: 2, comments: 0, shares: 1, saves: 1 } },
    ],
  },
  {
    _id: "p2",
    status: "published",
    publishedAt: "2026-09-10T05:00:00.000Z",
    analytics: { impressions: 10, reach: 10, likes: 1, comments: 0, shares: 0, saves: 0 },
    platformAnalytics: [
      { platform: "instagram", accountId: "acc1", analytics: { impressions: 10, reach: 10, likes: 1, comments: 0, shares: 0, saves: 0 } },
    ],
  },
  { _id: "p3", status: "scheduled", publishedAt: null, analytics: { impressions: 999 } },
];

describe("aggregateDaily", () => {
  const { points, daily } = aggregateDaily(accounts, posts, "2026-09-14");
  const get = (date: string, metric: string) =>
    points.find((p) => p.date === date && p.metric === metric)?.value;

  it("post metriklerini yayin gunune toplar, yayinlanmamisi atlar", () => {
    expect(get("2026-09-10", "social_impressions")).toBe(110);
    expect(get("2026-09-10", "social_reach")).toBe(90);
    // (5+1+2+2) + (1+0+0+0)
    expect(get("2026-09-10", "social_engagements")).toBe(11);
    expect(get("2026-09-10", "social_posts_published")).toBe(2);
    expect(points.some((p) => p.value === 999)).toBe(false);
  });

  it("takipciyi bugune, yalnizca aktif ve sayisi olan hesaplardan yazar", () => {
    // acc2 null (eklenti yok), acc3 pasif -> sadece acc1
    expect(get("2026-09-14", "social_followers")).toBe(120);
  });

  it("hesap x gun kirilimini uretir ve bugunku takipciyi ekler", () => {
    const acc1Day = daily.find((d) => d.account_id === "acc1" && d.date === "2026-09-10");
    expect(acc1Day).toEqual({
      account_id: "acc1", date: "2026-09-10", followers: null,
      impressions: 70, reach: 60, engagements: 7,
    });
    const acc1Today = daily.find((d) => d.account_id === "acc1" && d.date === "2026-09-14");
    expect(acc1Today?.followers).toBe(120);
    expect(acc1Today?.impressions).toBe(0);
    // takipci sayisi olmayan hesap icin bugun satiri acilmaz
    expect(daily.some((d) => d.account_id === "acc2" && d.date === "2026-09-14")).toBe(false);
  });

  it("takipci sayisi hic yoksa social_followers yazilmaz", () => {
    const none = aggregateDaily([{ _id: "x", platform: "tiktok", followersCount: null, isActive: true }], [], "2026-09-14");
    expect(none.points.some((p) => p.metric === "social_followers")).toBe(false);
  });
});

describe("toAccountRows", () => {
  it("Zernio hesabini social_accounts satirina cevirir", () => {
    const rows = toAccountRows(accounts.slice(0, 1), "2026-09-14T00:00:00.000Z");
    expect(rows[0]).toEqual({
      id: "acc1", platform: "instagram", username: "brand_main", display_name: null,
      avatar_url: null, profile_url: null, followers_count: 120,
      is_active: true, needs_reconnection: false, synced_at: "2026-09-14T00:00:00.000Z",
    });
  });
});
```

- [ ] **Step 4: Testin başarısız olduğunu gör**

Run: `bun test supabase/functions/helm-ingest/connectors/zernio-aggregate.test.ts`
Expected: FAIL - modül bulunamadı.

- [ ] **Step 5: Saf toplamayı yaz**

```ts
// supabase/functions/helm-ingest/connectors/zernio-aggregate.ts
// Zernio ham verisini metrics + social_* satirlarina ceviren SAF katman.
// Deno API'si yok: bun test ile kosar.
//
// GUNLUK SERI KURALI: Zernio post analitigi kumulatiftir (bugun 100
// impression, yarin 130). Gunluk farki tutmak icin snapshot gecmisi gerekir,
// v1'de yok. Bu yuzden bir postun tum metrigi YAYIN GUNUNE yazilir; her gece
// ayni gunler yeniden hesaplanip upsert edilir, deger buyudukce gun buyur.
// Takipci ise anlik sayi: yalnizca bugune yazilir.
//
// Time: O(P * A)  P post, A post basina platform girdisi
// Space: O(D * H) D gun, H hesap

import type { MetricPoint } from "./types.ts";
import type { ZernioAccount, ZernioAnalyticsPost, ZernioPostAnalytics } from "../../_shared/zernio.ts";

export interface SocialAccountRow {
  id: string;
  platform: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  followers_count: number | null;
  is_active: boolean;
  needs_reconnection: boolean;
  synced_at: string;
}

export interface SocialAccountDailyRow {
  account_id: string;
  date: string;
  followers: number | null;
  impressions: number;
  reach: number;
  engagements: number;
}

interface DayTotals {
  impressions: number;
  reach: number;
  engagements: number;
  posts: number;
}

const PUBLISHED = new Set(["published", "partial"]);

const num = (v: number | undefined | null) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const engagementsOf = (a: ZernioPostAnalytics) =>
  num(a.likes) + num(a.comments) + num(a.shares) + num(a.saves);

const dayOf = (iso: string) => iso.slice(0, 10);

export function toAccountRows(accounts: ZernioAccount[], syncedAt: string): SocialAccountRow[] {
  return accounts.map((a) => ({
    id: a._id,
    platform: a.platform,
    username: a.username ?? null,
    display_name: a.displayName ?? null,
    avatar_url: a.profilePicture ?? null,
    profile_url: a.profileUrl ?? null,
    followers_count: typeof a.followersCount === "number" ? a.followersCount : null,
    is_active: a.isActive !== false,
    needs_reconnection: a.needsReconnection === true,
    synced_at: syncedAt,
  }));
}

function addDay(map: Map<string, DayTotals>, date: string, a: ZernioPostAnalytics): void {
  const cur = map.get(date) ?? { impressions: 0, reach: 0, engagements: 0, posts: 0 };
  cur.impressions += num(a.impressions);
  cur.reach += num(a.reach);
  cur.engagements += engagementsOf(a);
  cur.posts += 1;
  map.set(date, cur);
}

function addAccountDay(
  map: Map<string, SocialAccountDailyRow>,
  accountId: string,
  date: string,
  a: ZernioPostAnalytics | null | undefined,
  followers: number | null,
): void {
  const key = `${accountId}|${date}`;
  const cur = map.get(key) ?? { account_id: accountId, date, followers: null, impressions: 0, reach: 0, engagements: 0 };
  if (a) {
    cur.impressions += num(a.impressions);
    cur.reach += num(a.reach);
    cur.engagements += engagementsOf(a);
  }
  if (followers !== null) cur.followers = followers;
  map.set(key, cur);
}

export function aggregateDaily(
  accounts: ZernioAccount[],
  posts: ZernioAnalyticsPost[],
  today: string,
): { points: MetricPoint[]; daily: SocialAccountDailyRow[] } {
  const byDay = new Map<string, DayTotals>();
  const byAccountDay = new Map<string, SocialAccountDailyRow>();

  for (const post of posts) {
    if (!post.publishedAt || !PUBLISHED.has(post.status)) continue;
    const date = dayOf(post.publishedAt);
    // Toplamlar post.analytics'ten (platformlar arasi zaten toplanmis) -
    // platformAnalytics'i de toplarsak cift sayariz.
    addDay(byDay, date, post.analytics ?? {});
    for (const pa of post.platformAnalytics ?? []) {
      if (!pa.accountId) continue;
      addAccountDay(byAccountDay, pa.accountId, date, pa.analytics, null);
    }
  }

  const points: MetricPoint[] = [];
  for (const [date, t] of byDay) {
    points.push(
      { date, metric: "social_impressions", value: t.impressions },
      { date, metric: "social_reach", value: t.reach },
      { date, metric: "social_engagements", value: t.engagements },
      { date, metric: "social_posts_published", value: t.posts },
    );
  }

  // Takipci: aktif + sayisi olan hesaplar. Hicbiri yoksa metrik yazma -
  // sifir yazmak "takipci yok" derdi, dogrusu "olcum yok".
  let followersTotal = 0;
  let measured = false;
  for (const a of accounts) {
    if (a.isActive === false || typeof a.followersCount !== "number") continue;
    measured = true;
    followersTotal += a.followersCount;
    addAccountDay(byAccountDay, a._id, today, null, a.followersCount);
  }
  if (measured) points.push({ date: today, metric: "social_followers", value: followersTotal });

  return { points, daily: Array.from(byAccountDay.values()) };
}
```

- [ ] **Step 6: Testin geçtiğini gör**

Run: `bun test supabase/functions/helm-ingest/connectors/zernio-aggregate.test.ts`
Expected: PASS (5 test).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/zernio.ts supabase/functions/helm-ingest/connectors/types.ts supabase/functions/helm-ingest/connectors/zernio-aggregate.ts supabase/functions/helm-ingest/connectors/zernio-aggregate.test.ts
git commit -m "feat(ingest): WES-000 zernio istemcisi ve saf gunluk toplama katmani"
```

---

### Task 5: Connector ve üç kayıt (ingest, test, verify)

**Files:**
- Create: `supabase/functions/helm-ingest/connectors/zernio.ts`
- Modify: `supabase/functions/helm-ingest/index.ts:20-36` (kayıt), `:54-63` (gövde), `:74-80` (filtre), `:158-177` sonrası (`extra`)
- Modify: `supabase/functions/helm-test/index.ts:2-38`, `:111-120`
- Modify: `supabase/functions/helm-verify/index.ts:2-38`, `:82-84`

**Interfaces:**
- Consumes: `listAccounts`, `listAnalyticsPosts`, `resolveProfileId` (Task 4), `aggregateDaily`, `toAccountRows` (Task 4), `ExtraUpsert`, `daysAgo` (Task 4).
- Produces: `fetchZernio: Connector`; `helm-ingest` gövdesi `{ trigger?, project_id?, provider? }` kabul eder.

- [ ] **Step 1: Connector**

```ts
// supabase/functions/helm-ingest/connectors/zernio.ts
import { type Connector, daysAgo, today } from "./types.ts";
import { listAccounts, listAnalyticsPosts, resolveProfileId } from "../../_shared/zernio.ts";
import { aggregateDaily, toAccountRows } from "./zernio-aggregate.ts";

// Zernio - sosyal hesaplar + post analitigi.
// config: { api_key, profile_id? }
// Cikti: metrics (social_*), social_accounts, social_account_daily (extra).
// Son 90 gun her gece yeniden toplanir; kumulatif degerler upsert ile buyur.

const DAYS_BACK = 90;

export const fetchZernio: Connector = async (config) => {
  const apiKey = config.api_key;
  if (!apiKey) throw new Error("Zernio api_key eksik");

  const profileId = await resolveProfileId(apiKey, config.profile_id);
  const accounts = await listAccounts(apiKey, profileId);
  const to = today();
  const posts = await listAnalyticsPosts(apiKey, profileId, daysAgo(DAYS_BACK), to);

  const syncedAt = new Date().toISOString();
  const { points, daily } = aggregateDaily(accounts, posts, to);

  return {
    points,
    extra: [
      // Sira onemli: daily -> accounts FK'si.
      { table: "social_accounts", rows: toAccountRows(accounts, syncedAt), onConflict: "id", withProjectId: true },
      { table: "social_account_daily", rows: daily, onConflict: "account_id,date", withProjectId: false },
    ],
  };
};
```

- [ ] **Step 2: helm-ingest kayıt + provider filtresi + extra**

`index.ts` import bloğuna (`fetchGooglePlay` satırından sonra):

```ts
import { fetchZernio } from "./connectors/zernio.ts";
```

`CONNECTORS` nesnesine:

```ts
  zernio: fetchZernio,
```

Gövde ayrıştırma bloğunu (satır 54-63) şu hale getir:

```ts
  // İstek gövdesi: trigger (panel "manual", cron yok) + opsiyonel project_id
  // + opsiyonel provider (webhook tetiklediğinde yalnızca o sağlayıcı koşar).
  let trigger: "manual" | "cron" = "cron";
  let projectId: string | undefined;
  let providerFilter: string | undefined;
  try {
    const body = await req.json();
    if (body?.trigger === "manual") trigger = "manual";
    if (typeof body?.project_id === "string") projectId = body.project_id;
    if (typeof body?.provider === "string") providerFilter = body.provider;
  } catch {
    // gövde yok - cron
  }
```

Filtre bloğuna (`if (projectId) {...}` sonrasına):

```ts
  if (providerFilter) {
    integrationsQuery = integrationsQuery.eq("provider", providerFilter);
  }
```

`syncIntegration` içinde `byFormat` yazımından sonra, `project_integrations` güncellemesinden önce:

```ts
      // Connector'ın metrics dışı satırları (ör. zernio → social_accounts).
      // Sırayla: bir tablo diğerine FK ile bağlı olabilir.
      const extra = Array.isArray(result) ? [] : (result.extra ?? []);
      let extraCount = 0;
      for (const ex of extra) {
        if (ex.rows.length === 0) continue;
        const rows = ex.withProjectId
          ? ex.rows.map((r) => ({ project_id: it.project_id, ...r }))
          : ex.rows;
        const { error: exErr } = await hub
          .from(ex.table)
          .upsert(rows, { onConflict: ex.onConflict });
        if (exErr) throw new Error(`${ex.table}: ${exErr.message}`);
        extraCount += rows.length;
      }
```

Dönüş nesnesindeki `ingested` satırını:

```ts
        ingested: rows.length + byCountry.length + byFormat.length + extraCount,
```

- [ ] **Step 3: helm-test kayıt ve nesne dönüşü**

Import bloğuna:

```ts
import { fetchAppStoreConnect } from "../helm-ingest/connectors/app-store-connect.ts";
import { fetchZernio } from "../helm-ingest/connectors/zernio.ts";
```

`CONNECTORS`'a:

```ts
  app_store_connect: fetchAppStoreConnect,
  zernio: fetchZernio,
```

`try` bloğunu (satır 111-120) şu hale getir:

```ts
  try {
    const result = await connector(integ.config ?? {});
    // Connector düz dizi ya da {points, extra…} döner; ikisini de göster.
    const points = Array.isArray(result) ? result : result.points;
    const extra = Array.isArray(result) ? [] : (result.extra ?? []);
    const ms = Date.now() - t0;
    return json({
      ok: true,
      provider: integ.provider,
      duration_ms: ms,
      count: points.length,
      points: points.slice(0, 100), // ilk 100 - UI'da göstermek için
      extra: extra.map((e) => ({ table: e.table, rows: e.rows.length })),
    });
  }
```

- [ ] **Step 4: helm-verify kayıt ve normalize**

Import bloğuna:

```ts
import { fetchAppStoreConnect } from "../helm-ingest/connectors/app-store-connect.ts";
import { fetchGooglePlay } from "../helm-ingest/connectors/google-play.ts";
import { fetchZernio } from "../helm-ingest/connectors/zernio.ts";
```

`CONNECTORS`'a:

```ts
  app_store_connect: fetchAppStoreConnect,
  google_play_developer: fetchGooglePlay,
  zernio: fetchZernio,
```

Satır 82-84'teki `upstream = await connector(...)` çağrısını:

```ts
    const result = await connector(integ.config ?? {});
    upstream = Array.isArray(result) ? result : result.points;
```

- [ ] **Step 5: Deploy ve gerçek çalıştırma**

Run:
```bash
make fn-deploy FN=helm-ingest && make fn-deploy FN=helm-test && make fn-deploy FN=helm-verify
```
Expected: üçü de deploy edildi.

Sonra web panelde (Entegrasyonlar → proje → Zernio) API key ile bir entegrasyon oluştur (Task 3 sonrası form var). "Test" butonuna bas.
Expected: `ok: true`, `count > 0`, `extra: [{table:"social_accounts", rows: 2}, {table:"social_account_daily", rows: N}]`.

Run (SQL editor):
```sql
select count(*) from public.social_accounts;
select date, metric, value from public.metrics where source = 'zernio' order by date desc limit 10;
```
Expected: Test yazmaz; sayı 0. Sonra web "Senkronla" (helm-ingest manual) sonrası 2 hesap ve `social_*` satırları görünür.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/helm-ingest/connectors/zernio.ts supabase/functions/helm-ingest/index.ts supabase/functions/helm-test/index.ts supabase/functions/helm-verify/index.ts
git commit -m "feat(ingest): WES-000 zernio connector'i ve extra upsert kanalini ekle"
```

---

### Task 6: Cockpit push'unu paylaşılan modüle taşı

**Files:**
- Create: `supabase/functions/_shared/expo-push.ts`
- Modify: `supabase/functions/helm-alert/index.ts:48-89` (yerel `sendExpoPush` silinir) ve çağrı yerleri

**Interfaces:**
- Produces: `sendCockpitPush(hub, title, body, data): Promise<boolean>`; `data.kind` zorunlu (`"alert" | "social"`).

- [ ] **Step 1: Paylaşılan modül**

```ts
// supabase/functions/_shared/expo-push.ts
// Cockpit'e (Can'in telefonuna) Expo push. helm_push_devices'taki tum
// token'lara gider; token yoksa sessizce false. helm-alert'ten tasindi:
// helm-zernio-webhook da ayni kanali kullanir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Hub = ReturnType<typeof createClient>;

export interface CockpitPushData {
  kind: "alert" | "social";
  [key: string]: unknown;
}

export async function sendCockpitPush(
  hub: Hub,
  title: string,
  body: string,
  data: CockpitPushData,
): Promise<boolean> {
  const { data: devices } = await hub.from("helm_push_devices").select("token");
  const tokens = Array.from(
    new Set(
      (devices ?? [])
        .map((d: { token: string }) => d.token)
        .filter(
          (t: unknown): t is string =>
            typeof t === "string" && t.startsWith("ExponentPushToken["),
        ),
    ),
  );
  if (tokens.length === 0) return false;

  const messages = tokens.map((to) => ({ to, title, body, sound: "default", data }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: helm-alert'i buna bağla**

`helm-alert/index.ts` içinde satır 48-89 arasındaki yerel `sendExpoPush` fonksiyonunu ve üstündeki yorumu sil. Import bloğuna:

```ts
import { sendCockpitPush } from "../_shared/expo-push.ts";
```

Çağrı yerlerini bul: `grep -n "sendExpoPush(" supabase/functions/helm-alert/index.ts`. Her `sendExpoPush(hub, X, Y)` çağrısını `sendCockpitPush(hub, X, Y, { kind: "alert" })` yap. Başka değişiklik yok; davranış aynı.

- [ ] **Step 3: Deploy ve doğrula**

Run: `make fn-deploy FN=helm-alert`
Web → Uyarılar → bir kuralda "Test" (bu sayfa `helm-alert`'i `rule_id` ile çağırır).
Expected: önceki davranışla aynı; telefona push gelir (cihaz kayıtlıysa).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/expo-push.ts supabase/functions/helm-alert/index.ts
git commit -m "refactor(functions): WES-000 cockpit push gonderimini paylasilan module tasi"
```

---

### Task 7: Webhook imza doğrulama ve `helm-zernio-webhook`

**Files:**
- Create: `supabase/functions/_shared/zernio-signature.ts`
- Test: `supabase/functions/_shared/zernio-signature.test.ts`
- Create: `supabase/functions/helm-zernio-webhook/index.ts`

**Interfaces:**
- Consumes: `sendCockpitPush` (Task 6).
- Produces: `verifyZernioSignature(secret, rawBody, header): Promise<boolean>`; webhook URL `${SUPABASE_URL}/functions/v1/helm-zernio-webhook`; olay işleme `webhook.test`, `account.connected`, `account.disconnected`, `analytics.synced`.

- [ ] **Step 1: Başarısız imza testi**

```ts
// supabase/functions/_shared/zernio-signature.test.ts
import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyZernioSignature } from "./zernio-signature";

const secret = "whsec_test_123";
const body = JSON.stringify({ id: "evt_1", event: "webhook.test", data: {} });
const hex = createHmac("sha256", secret).update(body).digest("hex");
const b64 = createHmac("sha256", secret).update(body).digest("base64");

describe("verifyZernioSignature", () => {
  it("hex imzayi kabul eder (duz ve sha256= onekli)", async () => {
    expect(await verifyZernioSignature(secret, body, hex)).toBe(true);
    expect(await verifyZernioSignature(secret, body, `sha256=${hex}`)).toBe(true);
  });
  it("base64 imzayi kabul eder", async () => {
    expect(await verifyZernioSignature(secret, body, b64)).toBe(true);
  });
  it("yanlis secret, degismis govde ve eksik header reddedilir", async () => {
    expect(await verifyZernioSignature("baska", body, hex)).toBe(false);
    expect(await verifyZernioSignature(secret, body + " ", hex)).toBe(false);
    expect(await verifyZernioSignature(secret, body, null)).toBe(false);
    expect(await verifyZernioSignature(secret, body, "")).toBe(false);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `bun test supabase/functions/_shared/zernio-signature.test.ts`
Expected: FAIL - modül yok.

- [ ] **Step 3: Doğrulamayı yaz**

```ts
// supabase/functions/_shared/zernio-signature.ts
// Zernio webhook imzasi: X-Zernio-Signature, HMAC-SHA256, abonelik secret'i.
// Spec imzanin ham govde uzerinde oldugunu soyluyor ama kodlamayi (hex/base64)
// ve onek ("sha256=") kullanimini yazmiyor; ikisini de kabul ediyoruz.
// Sabit zamanli karsilastirma: imza uzunlugu sizdirmasin.
// Web Crypto: Deno ve bun'da ayni.

const enc = new TextEncoder();

async function hmac(secret: string, body: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyZernioSignature(
  secret: string,
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  if (!header) return false;
  const given = header.trim().replace(/^sha256=/i, "");
  if (!given) return false;
  const mac = await hmac(secret, rawBody);
  return (
    timingSafeEqual(given.toLowerCase(), toHex(mac)) ||
    timingSafeEqual(given, toBase64(mac))
  );
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `bun test supabase/functions/_shared/zernio-signature.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Webhook fonksiyonu**

```ts
// supabase/functions/helm-zernio-webhook/index.ts
// Zernio webhook alicisi. Deploy: --no-verify-jwt (Zernio Supabase JWT'si
// gondermez; guvenlik HMAC imzasindan gelir).
//
// Bu alt projede islenen olaylar:
//   webhook.test          -> 200
//   account.connected     -> zernio ingest'i tetikle (hesap listesi yenilensin)
//   account.disconnected  -> social_accounts.needs_reconnection + cockpit push
//   analytics.synced      -> zernio ingest'i tetikle
// post.* (alt proje 2) ve message/comment.received (alt proje 3) burada
// 200 ile YUTULUR ki Zernio tekrar denemesin; islenmeleri sonraki alt projede.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyZernioSignature } from "../_shared/zernio-signature.ts";
import { sendCockpitPush } from "../_shared/expo-push.ts";

interface ZernioEvent {
  id?: string;
  event?: string;
  type?: string;
  data?: Record<string, unknown>;
}

/** data.accountId | data.account._id | data.account.id - hangisi geldiyse. */
function accountIdOf(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.accountId === "string") return data.accountId;
  const acc = data.account as Record<string, unknown> | undefined;
  if (acc && typeof acc._id === "string") return acc._id;
  if (acc && typeof acc.id === "string") return acc.id;
  return null;
}

async function triggerZernioIngest(): Promise<void> {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/helm-ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "manual", provider: "zernio" }),
    });
  } catch {
    // ingest tetiklenemezse gece cron'u toplar
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST bekleniyor" }, 405);

  const secret = Deno.env.get("ZERNIO_WEBHOOK_SECRET");
  if (!secret) {
    console.error("ZERNIO_WEBHOOK_SECRET tanimsiz");
    return json({ error: "webhook secret yapilandirilmamis" }, 500);
  }

  const rawBody = await req.text();
  const ok = await verifyZernioSignature(secret, rawBody, req.headers.get("x-zernio-signature"));
  if (!ok) return json({ error: "Invalid signature" }, 401);

  let evt: ZernioEvent;
  try {
    evt = JSON.parse(rawBody) as ZernioEvent;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const name = evt.event ?? evt.type ?? "";
  const eventId = req.headers.get("x-zernio-event-id") ?? evt.id ?? null;

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  const background = (p: Promise<unknown>) => (runtime ? runtime.waitUntil(p) : p);

  switch (name) {
    case "webhook.test":
      return json({ ok: true, event: name, event_id: eventId });

    case "account.connected":
    case "analytics.synced":
      await background(triggerZernioIngest());
      return json({ ok: true, event: name, event_id: eventId });

    case "account.disconnected": {
      const accountId = accountIdOf(evt.data);
      if (!accountId) return json({ ok: true, event: name, skipped: "accountId yok" });
      const { data: acc } = await hub
        .from("social_accounts")
        .update({ needs_reconnection: true, is_active: false })
        .eq("id", accountId)
        .select("platform, username")
        .maybeSingle();
      const label = acc ? `${acc.platform} · ${acc.username ?? accountId}` : accountId;
      await sendCockpitPush(
        hub,
        "Sosyal hesap bağlantısı koptu",
        `${label} - Zernio'da yeniden bağla`,
        { kind: "social", accountId },
      );
      return json({ ok: true, event: name, event_id: eventId });
    }

    default:
      // Bilinmeyen / henuz islenmeyen olay: 200 don, Zernio retry yapmasin.
      return json({ ok: true, event: name, ignored: true });
  }
});
```

- [ ] **Step 6: Secret ve deploy**

Zernio abonelik secret'ı için rastgele bir değer üret ve Supabase'e koy (değeri repoya yazma):

```bash
SECRET=$(openssl rand -hex 32); supabase secrets set ZERNIO_WEBHOOK_SECRET="$SECRET" --project-ref $HELM_SUPABASE_PROJECT_ID; echo "kaydet: $SECRET"
```

```bash
supabase functions deploy helm-zernio-webhook --no-verify-jwt --project-ref $HELM_SUPABASE_PROJECT_ID
```

Expected: deploy tamam; fonksiyon URL'si `https://<ref>.supabase.co/functions/v1/helm-zernio-webhook`.

- [ ] **Step 7: Elle doğrula (imzasız istek 401)**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://$HELM_SUPABASE_PROJECT_ID.supabase.co/functions/v1/helm-zernio-webhook" -H 'Content-Type: application/json' -d '{"event":"webhook.test"}'
```
Expected: `401`.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/zernio-signature.ts supabase/functions/_shared/zernio-signature.test.ts supabase/functions/helm-zernio-webhook/index.ts
git commit -m "feat(functions): WES-000 zernio webhook alicisi ve hmac imza dogrulamasi"
```

---

### Task 8: `helm-social` - hesap senkronu ve webhook aboneliği

**Files:**
- Create: `supabase/functions/helm-social/index.ts`

**Interfaces:**
- Consumes: `resolveProfileId`, `listAccounts`, `zernioFetch`, `ZernioApiError` (Task 4); `toAccountRows` (Task 4).
- Produces: POST gövdesi `{ project_id: string; action: "accounts.sync" | "webhook.ensure"; params?: Record<string, unknown> }`; yanıt `accounts.sync → { ok: true, count }`, `webhook.ensure → { ok: true, webhook_id, created: boolean }`; hata `{ error, code?, status? }` Zernio'nun gövdesiyle.

- [ ] **Step 1: Fonksiyon**

```ts
// supabase/functions/helm-social/index.ts
// Kullanici JWT'siyle calisan Zernio aksiyon yonlendiricisi.
// Body: { project_id, action, params? }
// Alt proje 1 aksiyonlari: accounts.sync, webhook.ensure
// (alt proje 2: posts.*, media.presign; alt proje 3: inbox.*)
//
// Kalip helm-review-reply ile ayni: service-role client, aktor caller
// JWT'den, 60 sn'de 10 yazma siniri, her aksiyon audit_log'a.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  ZernioApiError,
  listAccounts,
  resolveProfileId,
  zernioFetch,
} from "../_shared/zernio.ts";
import { toAccountRows } from "../helm-ingest/connectors/zernio-aggregate.ts";

type Action = "accounts.sync" | "webhook.ensure";
const ACTIONS: ReadonlySet<string> = new Set(["accounts.sync", "webhook.ensure"]);

interface Body {
  project_id?: string;
  action?: string;
  params?: Record<string, unknown>;
}

interface ZernioWebhook {
  _id: string;
  url: string;
  isActive?: boolean;
}

/** Zernio'da abone olunan olaylar - alt projeler ekledikce buraya eklenir. */
const WEBHOOK_EVENTS = [
  "webhook.test",
  "account.connected",
  "account.disconnected",
  "analytics.synced",
  "post.scheduled",
  "post.published",
  "post.failed",
  "post.partial",
  "post.cancelled",
  "post.platform.published",
  "post.platform.failed",
  "message.received",
  "comment.received",
];

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const projectId = body.project_id;
  const action = body.action;
  if (!projectId || typeof projectId !== "string") return json({ error: "project_id gerekli" }, 400);
  if (!action || !ACTIONS.has(action)) return json({ error: "gecersiz action" }, 400);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Aktor: caller JWT'sinden. Anon istek 401.
  let actorEmail: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { data } = await hub.auth.getUser(authHeader.slice(7));
      actorEmail = data?.user?.email ?? null;
    } catch {
      // anon
    }
  }
  if (!actorEmail) return json({ error: "Authenticated request gerekli" }, 401);

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count: recent } = await hub
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_email", actorEmail)
    .like("action", "social.%")
    .gte("created_at", since);
  if ((recent ?? 0) >= RATE_MAX) return json({ error: "Too fast - wait a minute" }, 429);

  const { data: integ, error: integErr } = await hub
    .from("project_integrations")
    .select("id, config")
    .eq("project_id", projectId)
    .eq("provider", "zernio")
    .eq("enabled", true)
    .maybeSingle();
  if (integErr) return json({ error: integErr.message }, 500);
  if (!integ) return json({ error: "Bu projede Zernio entegrasyonu yok" }, 404);
  const cfg = (integ.config ?? {}) as Record<string, string | undefined>;
  const apiKey = cfg.api_key;
  if (!apiKey) return json({ error: "Zernio api_key eksik" }, 422);

  const audit = (detail: string) =>
    hub.from("audit_log").insert({
      project_id: projectId,
      action: `social.${action}`,
      actor_email: actorEmail,
      detail,
    });

  try {
    if (action === "accounts.sync") {
      const profileId = await resolveProfileId(apiKey, cfg.profile_id);
      const accounts = await listAccounts(apiKey, profileId);
      const rows = toAccountRows(accounts, new Date().toISOString()).map((r) => ({
        project_id: projectId,
        ...r,
      }));
      if (rows.length > 0) {
        const { error } = await hub.from("social_accounts").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }
      await audit(`${rows.length} hesap`);
      return json({ ok: true, count: rows.length });
    }

    // webhook.ensure
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/helm-zernio-webhook`;
    const secret = Deno.env.get("ZERNIO_WEBHOOK_SECRET");
    if (!secret) return json({ error: "ZERNIO_WEBHOOK_SECRET tanimsiz" }, 500);

    const listed = await zernioFetch<{ webhooks?: ZernioWebhook[] } | ZernioWebhook[]>(
      apiKey,
      "/webhooks/settings",
    );
    const existing = (Array.isArray(listed) ? listed : (listed.webhooks ?? [])).find(
      (w) => w.url === url,
    );
    if (existing) {
      await audit(`mevcut ${existing._id}`);
      return json({ ok: true, webhook_id: existing._id, created: false });
    }

    const created = await zernioFetch<{ webhook: ZernioWebhook }>(apiKey, "/webhooks/settings", {
      method: "POST",
      body: JSON.stringify({ name: "Helm", url, secret, events: WEBHOOK_EVENTS, isActive: true }),
    });
    const webhookId = created.webhook._id;
    await hub
      .from("project_integrations")
      .update({ config: { ...cfg, webhook_id: webhookId } })
      .eq("id", integ.id);
    await audit(`olusturuldu ${webhookId}`);
    return json({ ok: true, webhook_id: webhookId, created: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await hub.from("audit_log").insert({
      project_id: projectId,
      action: `social.${action}.fail`,
      actor_email: actorEmail,
      detail: message.slice(0, 500),
    });
    if (e instanceof ZernioApiError) {
      return json({ error: message, code: e.code, retry_after: e.retryAfter }, e.status === 429 ? 429 : 502);
    }
    return json({ error: message }, 500);
  }
});
```

- [ ] **Step 2: Deploy**

Run: `make fn-deploy FN=helm-social`
Expected: deploy tamam.

- [ ] **Step 3: Gerçek çağrı ile doğrula**

Web uygulamasında oturum açıkken tarayıcı konsolunda (`supabaseClient` global değilse geçici olarak `window.__sb = supabaseClient` ekleyip sonra kaldır):

```js
await window.__sb.functions.invoke("helm-social", { body: { project_id: "<PROJE_UUID>", action: "accounts.sync" } })
await window.__sb.functions.invoke("helm-social", { body: { project_id: "<PROJE_UUID>", action: "webhook.ensure" } })
```
Expected: `{ ok: true, count: 2 }` ve `{ ok: true, webhook_id: "…", created: true }`. İkinci `webhook.ensure` çağrısı `created: false` döner. Zernio panelinde webhook görünür. Sonra Zernio'da "test event" gönder (`POST /v1/webhooks/test` panelden ya da curl ile) → Supabase fonksiyon loglarında 200.

▎ İmza formülü burada netleşir. Test olayı 401 alırsa `_shared/zernio-signature.ts`'i Zernio'nun gerçek formülüne (ör. `timestamp.body`) göre düzelt, testi güncelle, yeniden deploy et. Değişikliği bu task'ın commit'ine değil ayrı bir `fix(functions)` commit'ine koy.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/helm-social/index.ts
git commit -m "feat(functions): WES-000 helm-social ile hesap senkronu ve webhook aboneligi"
```

---

### Task 9: Paylaşılan katman - `@helm/api` ve `@helm/queries`

**Files:**
- Create: `packages/api/src/social.ts`
- Test: `packages/api/src/social.test.ts`
- Modify: `packages/api/src/index.ts` (export satırı)
- Create: `packages/queries/src/social.ts`
- Modify: `packages/queries/src/index.ts` (export satırı)

**Interfaces:**
- Produces (`@helm/api`): `SocialAccount`, `SocialAccountDaily`, `SocialMetricRow { date; metric; value }`, `SocialKpis`, `SOCIAL_METRICS`, `fetchSocialAccounts(client, propertyId)`, `fetchSocialMetricRows(client, propertyId, days)`, `summarizeSocialKpis(rows, days, today)`, `fetchSocialAccountDaily(client, accountIds, days)`, `invokeSocial<T>(client, body)`.
- Produces (`@helm/queries`): `socialKeys`, `socialAccountsQueryOptions(client, propertyId)`, `socialKpisQueryOptions(client, propertyId, days)`, `socialAccountDailyQueryOptions(client, accountIds, days)`.

- [ ] **Step 1: Başarısız özet testi**

```ts
// packages/api/src/social.test.ts
import { describe, expect, it } from "bun:test";
import { summarizeSocialKpis, type SocialMetricRow } from "./social";

// 7 gunluk pencere: bugun 2026-09-14 -> cari 09-08..09-14, onceki 09-01..09-07.
const rows: SocialMetricRow[] = [
  { date: "2026-09-02", metric: "social_impressions", value: 50 },
  { date: "2026-09-09", metric: "social_impressions", value: 100 },
  { date: "2026-09-12", metric: "social_impressions", value: 20 },
  { date: "2026-09-09", metric: "social_engagements", value: 4 },
  { date: "2026-09-08", metric: "social_followers", value: 100 },
  { date: "2026-09-14", metric: "social_followers", value: 110 },
  { date: "2026-09-12", metric: "social_posts_published", value: 2 },
];

describe("summarizeSocialKpis", () => {
  const k = summarizeSocialKpis(rows, 7, "2026-09-14");

  it("sayaclari cari pencerede toplar ve onceki pencereye gore yuzde verir", () => {
    expect(k.impressions).toBe(120);
    expect(k.impressionsDelta).toBeCloseTo(140, 5); // (120-50)/50
    expect(k.engagements).toBe(4);
    expect(k.engagementsDelta).toBeNull(); // onceki 0 -> yuzde tanimsiz
    expect(k.postsPublished).toBe(2);
  });

  it("takipci son olcumdur, deltasi pencere basina gore", () => {
    expect(k.followers).toBe(110);
    expect(k.followersDelta).toBeCloseTo(10, 5); // (110-100)/100
  });

  it("veri yoksa null/0 doner", () => {
    const empty = summarizeSocialKpis([], 7, "2026-09-14");
    expect(empty.followers).toBeNull();
    expect(empty.impressions).toBe(0);
    expect(empty.impressionsDelta).toBeNull();
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `bun test packages/api/src/social.test.ts`
Expected: FAIL - modül yok.

- [ ] **Step 3: `@helm/api` modülü**

```ts
// packages/api/src/social.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

// Sosyal (Zernio) okuma katmani. Toplamlar metrics'ten (source=zernio),
// hesaplar social_accounts'tan, kirilim social_account_daily'den.
// Yazma islemleri helm-social edge function'ina gider (invokeSocial).

export interface SocialAccount {
  id: string;
  project_id: string;
  platform: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  followers_count: number | null;
  is_active: boolean;
  needs_reconnection: boolean;
  synced_at: string;
}

export interface SocialAccountDaily {
  account_id: string;
  date: string;
  followers: number | null;
  impressions: number;
  reach: number;
  engagements: number;
}

export interface SocialMetricRow {
  date: string;
  metric: string;
  value: number;
}

export interface SocialKpis {
  followers: number | null;
  /** Pencere basindaki ilk olcume gore yuzde. */
  followersDelta: number | null;
  impressions: number;
  impressionsDelta: number | null;
  reach: number;
  reachDelta: number | null;
  engagements: number;
  engagementsDelta: number | null;
  postsPublished: number;
}

export const SOCIAL_METRICS = [
  "social_followers",
  "social_impressions",
  "social_reach",
  "social_engagements",
  "social_posts_published",
] as const;

const ACCOUNT_COLUMNS =
  "id, project_id, platform, username, display_name, avatar_url, profile_url, followers_count, is_active, needs_reconnection, synced_at";

export async function fetchSocialAccounts(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<SocialAccount[]> {
  let q = client.from("social_accounts").select(ACCOUNT_COLUMNS).order("platform");
  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SocialAccount[];
}

const isoDaysAgo = (n: number, today: string) =>
  new Date(new Date(`${today}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

/** Iki pencere (cari + onceki) icin satirlari ceker: 2*days gun. */
export async function fetchSocialMetricRows(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  days: number,
): Promise<SocialMetricRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  let q = client
    .from("metrics")
    .select("date, metric, value")
    .eq("source", "zernio")
    .in("metric", [...SOCIAL_METRICS])
    .gte("date", isoDaysAgo(2 * days - 1, today))
    .order("date");
  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Array<{ date: string; metric: string; value: string | number }>).map(
    (r) => ({ date: r.date, metric: r.metric, value: Number(r.value) }),
  );
}

const pct = (cur: number, prev: number): number | null =>
  prev > 0 ? ((cur - prev) / prev) * 100 : null;

/**
 * Cari pencere: today-days+1..today. Onceki: bir oncekli ayni uzunluk.
 * Sayaclar toplanir; takipci penceredeki SON olcumdur, deltasi penceredeki
 * ILK olcume gore (anlik metrik toplanmaz).
 * Time: O(n), Space: O(1) sabit sayida toplam.
 */
export function summarizeSocialKpis(
  rows: SocialMetricRow[],
  days: number,
  today: string,
): SocialKpis {
  const curStart = isoDaysAgo(days - 1, today);
  const prevStart = isoDaysAgo(2 * days - 1, today);
  const sum = { cur: { impressions: 0, reach: 0, engagements: 0, posts: 0 }, prev: { impressions: 0, reach: 0, engagements: 0 } };
  let firstFollowers: { date: string; value: number } | null = null;
  let lastFollowers: { date: string; value: number } | null = null;

  for (const r of rows) {
    const inCur = r.date >= curStart && r.date <= today;
    const inPrev = r.date >= prevStart && r.date < curStart;
    if (r.metric === "social_followers") {
      if (!inCur) continue;
      if (!firstFollowers || r.date < firstFollowers.date) firstFollowers = r;
      if (!lastFollowers || r.date > lastFollowers.date) lastFollowers = r;
      continue;
    }
    const bucket = inCur ? sum.cur : inPrev ? sum.prev : null;
    if (!bucket) continue;
    if (r.metric === "social_impressions") bucket.impressions += r.value;
    else if (r.metric === "social_reach") bucket.reach += r.value;
    else if (r.metric === "social_engagements") bucket.engagements += r.value;
    else if (r.metric === "social_posts_published" && inCur) sum.cur.posts += r.value;
  }

  return {
    followers: lastFollowers?.value ?? null,
    followersDelta:
      lastFollowers && firstFollowers && firstFollowers.date !== lastFollowers.date
        ? pct(lastFollowers.value, firstFollowers.value)
        : null,
    impressions: sum.cur.impressions,
    impressionsDelta: pct(sum.cur.impressions, sum.prev.impressions),
    reach: sum.cur.reach,
    reachDelta: pct(sum.cur.reach, sum.prev.reach),
    engagements: sum.cur.engagements,
    engagementsDelta: pct(sum.cur.engagements, sum.prev.engagements),
    postsPublished: sum.cur.posts,
  };
}

export async function fetchSocialAccountDaily(
  client: SupabaseClient,
  accountIds: string[],
  days: number,
): Promise<SocialAccountDaily[]> {
  if (accountIds.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from("social_account_daily")
    .select("account_id, date, followers, impressions, reach, engagements")
    .in("account_id", accountIds)
    .gte("date", isoDaysAgo(days - 1, today))
    .order("date");
  if (error) throw error;
  return (data ?? []) as SocialAccountDaily[];
}

export type SocialAction = "accounts.sync" | "webhook.ensure";

export async function invokeSocial<T = { ok: boolean }>(
  client: SupabaseClient,
  body: { project_id: string; action: SocialAction; params?: Record<string, unknown> },
): Promise<T> {
  const { data, error } = await client.functions.invoke("helm-social", { body });
  if (error) throw error;
  const res = data as { ok?: boolean; error?: string };
  if (res?.ok !== true) throw new Error(res?.error ?? "helm-social basarisiz");
  return data as T;
}
```

`packages/api/src/index.ts` sonuna:

```ts
export * from "./social";
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `bun test packages/api/src/social.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: `@helm/queries` modülü**

```ts
// packages/queries/src/social.ts
import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import {
  fetchSocialAccountDaily,
  fetchSocialAccounts,
  fetchSocialMetricRows,
  summarizeSocialKpis,
} from "@helm/api";

export const socialKeys = {
  all: ["social"] as const,
  accounts: (id: SelectedPropertyId) => ["social", "accounts", id] as const,
  kpis: (id: SelectedPropertyId, days: number) => ["social", "kpis", id, days] as const,
  daily: (ids: string[], days: number) => ["social", "daily", ids.slice().sort().join(","), days] as const,
};

export function socialAccountsQueryOptions(client: SupabaseClient, propertyId: SelectedPropertyId) {
  return queryOptions({
    queryKey: socialKeys.accounts(propertyId),
    queryFn: () => fetchSocialAccounts(client, propertyId),
    staleTime: 5 * 60_000,
  });
}

export function socialKpisQueryOptions(client: SupabaseClient, propertyId: SelectedPropertyId, days: number) {
  return queryOptions({
    queryKey: socialKeys.kpis(propertyId, days),
    queryFn: async () => {
      const rows = await fetchSocialMetricRows(client, propertyId, days);
      return summarizeSocialKpis(rows, days, new Date().toISOString().slice(0, 10));
    },
    staleTime: 5 * 60_000,
  });
}

export function socialAccountDailyQueryOptions(client: SupabaseClient, accountIds: string[], days: number) {
  return queryOptions({
    queryKey: socialKeys.daily(accountIds, days),
    queryFn: () => fetchSocialAccountDaily(client, accountIds, days),
    staleTime: 5 * 60_000,
    enabled: accountIds.length > 0,
  });
}
```

`packages/queries/src/index.ts` sonuna:

```ts
export * from "./social";
```

- [ ] **Step 6: Typecheck**

Run: `make typecheck`
Expected: hata yok.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/social.ts packages/api/src/social.test.ts packages/api/src/index.ts packages/queries/src/social.ts packages/queries/src/index.ts
git commit -m "feat(api): WES-000 sosyal hesap, kpi ve helm-social cagri katmani"
```

---

### Task 10: Web - `/social` genel bakış sayfası ve panel bağlantısı

**Files:**
- Create: `apps/web/src/hooks/use-social.ts`
- Create: `apps/web/src/pages/social/index.tsx`
- Modify: `apps/web/src/App.tsx:82-84` (lazy), `:195-199` (resource), `:308` (route)
- Modify: `apps/web/src/components/layout/index.tsx:131-140` (nav)
- Modify: `apps/web/src/components/integrations-panel/index.tsx:493-523` (`handleSave`)

**Interfaces:**
- Consumes: `socialAccountsQueryOptions`, `socialKpisQueryOptions`, `socialAccountDailyQueryOptions`, `invokeSocial` (Task 9); `useScope` (`@/context/scope`), `PageStatus`, `Card`, `Table`, `Badge` (mevcut ui).
- Produces: route `/social`, Refine resource `social`, sidebar "Sosyal".

- [ ] **Step 1: Hook'lar**

```ts
// apps/web/src/hooks/use-social.ts
import { useQuery } from "@tanstack/react-query";
import {
  socialAccountDailyQueryOptions,
  socialAccountsQueryOptions,
  socialKpisQueryOptions,
} from "@helm/queries";

import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";

export function useSocialAccounts() {
  const { scope, isAll } = useScope();
  return useQuery(socialAccountsQueryOptions(supabaseClient, isAll ? "all" : scope));
}

export function useSocialKpis(days: number) {
  const { scope, isAll } = useScope();
  return useQuery(socialKpisQueryOptions(supabaseClient, isAll ? "all" : scope, days));
}

export function useSocialAccountDaily(accountIds: string[], days: number) {
  return useQuery(socialAccountDailyQueryOptions(supabaseClient, accountIds, days));
}
```

- [ ] **Step 2: Sayfa**

```tsx
// apps/web/src/pages/social/index.tsx
import { useMemo, useState } from "react";
import { ExternalLink, Share2, TriangleAlert } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageStatus } from "@/components/ui/page-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSocialAccountDaily, useSocialAccounts, useSocialKpis } from "@/hooks/use-social";

const WINDOWS = [7, 30, 90] as const;
type Window = (typeof WINDOWS)[number];

const fmtInt = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("tr-TR").format(n);
const fmtDelta = (d: number | null | undefined) =>
  d == null ? null : `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;

function Kpi({ label, value, delta }: { label: string; value: string; delta: string | null }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{delta ?? "önceki dönem yok"}</div>
      </CardContent>
    </Card>
  );
}

export const SocialPage = () => {
  const [days, setDays] = useState<Window>(30);
  const accounts = useSocialAccounts();
  const kpis = useSocialKpis(days);
  const accountIds = useMemo(() => (accounts.data ?? []).map((a) => a.id), [accounts.data]);
  const daily = useSocialAccountDaily(accountIds, days);

  // Gun bazinda tum hesaplarin toplami - grafik icin. O(n).
  const series = useMemo(() => {
    const byDay = new Map<string, { date: string; impressions: number; engagements: number }>();
    for (const r of daily.data ?? []) {
      const cur = byDay.get(r.date) ?? { date: r.date, impressions: 0, engagements: 0 };
      cur.impressions += r.impressions;
      cur.engagements += r.engagements;
      byDay.set(r.date, cur);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [daily.data]);

  if (accounts.isLoading || kpis.isLoading) return <PageStatus tone="loading" label="Sosyal veriler yükleniyor" />;
  if (accounts.error) return <PageStatus tone="error" label={accounts.error.message} />;
  if ((accounts.data ?? []).length === 0) {
    return (
      <PageStatus
        tone="empty"
        label="Bağlı sosyal hesap yok. Entegrasyonlar → Zernio ile bağla, sonra Senkronla."
      />
    );
  }

  const k = kpis.data;
  const needsReconnect = (accounts.data ?? []).filter((a) => a.needs_reconnection);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Share2 className="size-5" /> Sosyal
        </h1>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as Window)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {WINDOWS.map((w) => (
              <SelectItem key={w} value={String(w)}>Son {w} gün</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsReconnect.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="size-4 text-amber-500" />
          {needsReconnect.map((a) => `${a.platform} · ${a.username ?? a.id}`).join(", ")} bağlantısı koptu.
          <a className="underline" href="https://zernio.com" target="_blank" rel="noreferrer">Zernio'da yeniden bağla</a>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Takipçi" value={fmtInt(k?.followers)} delta={fmtDelta(k?.followersDelta)} />
        <Kpi label="Impression" value={fmtInt(k?.impressions)} delta={fmtDelta(k?.impressionsDelta)} />
        <Kpi label="Reach" value={fmtInt(k?.reach)} delta={fmtDelta(k?.reachDelta)} />
        <Kpi label="Etkileşim" value={fmtInt(k?.engagements)} delta={fmtDelta(k?.engagementsDelta)} />
        <Kpi label="Yayınlanan" value={fmtInt(k?.postsPublished)} delta={null} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Impression ve etkileşim (yayın gününe göre)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {series.length === 0 ? (
            <PageStatus tone="empty" label="Bu pencerede yayın yok" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                <YAxis fontSize={11} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="impressions" stroke="currentColor" dot={false} name="Impression" />
                <Line type="monotone" dataKey="engagements" stroke="#f59e0b" dot={false} name="Etkileşim" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Hesaplar</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hesap</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Takipçi</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="flex items-center gap-2">
                    {a.avatar_url && <img src={a.avatar_url} alt="" className="size-6 rounded-full" />}
                    <span>{a.display_name ?? a.username ?? a.id}</span>
                    {a.username && <span className="text-muted-foreground">@{a.username}</span>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{a.platform}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(a.followers_count)}</TableCell>
                  <TableCell>
                    {a.needs_reconnection ? (
                      <Badge variant="destructive">yeniden bağla</Badge>
                    ) : a.is_active ? (
                      <Badge>aktif</Badge>
                    ) : (
                      <Badge variant="outline">pasif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.profile_url && (
                      <a href={a.profile_url} target="_blank" rel="noreferrer" aria-label="Profili aç">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
```

`PageStatus`'un `tone` değerleri için `apps/web/src/components/ui/page-status.tsx` içindeki `PageStatusTone` tipine bak; `"loading" | "error" | "empty"` yoksa oradaki adları kullan.

- [ ] **Step 3: Route, resource, sidebar**

`App.tsx` lazy bloğuna (`CampaignsPage` tanımından sonra):

```tsx
const SocialPage = lazy(() =>
  import("@/pages/social").then((m) => ({ default: m.SocialPage })),
);
```

`resources` dizisine (`campaigns` girdisinden sonra):

```tsx
                { name: "social", list: "/social", meta: { label: "Sosyal" } },
```

Route bloğuna (`/campaigns` satırından sonra):

```tsx
                    <Route path="/social" element={<SocialPage />} />
```

`components/layout/index.tsx` "Mesajlaşma" grubunun `items` dizisine (`Kampanya geçmişi` girdisinden sonra); dosyanın lucide import satırına `Share2` ekle:

```tsx
      { title: "Sosyal", icon: Share2, url: "/social", requires: "social" },
```

- [ ] **Step 4: Panel kayıt sonrası bağlantı kurulumu**

`integrations-panel/index.tsx` import bloğuna:

```tsx
import { invokeSocial } from "@helm/api";
```

`handleSave` içindeki `create(...)` çağrısının `onSuccess`'ini şu hale getir:

```tsx
          onSuccess: async () => {
            setOpen(false);
            resetForm();
            // Zernio: kaydin hemen ardindan hesaplari cek + webhook'u kur.
            // Kullanici ayrica bir dugmeye basmasin; bu iki adim olmadan
            // sayfa bos kalir ve olaylar gelmez.
            if (provider === "zernio" && projectId) {
              try {
                await invokeSocial(supabaseClient, { project_id: projectId, action: "accounts.sync" });
                await invokeSocial(supabaseClient, { project_id: projectId, action: "webhook.ensure" });
                toast.success("Zernio bağlandı: hesaplar çekildi, webhook kuruldu");
              } catch (e) {
                toast.error(`Zernio kurulumu eksik: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          },
```

- [ ] **Step 5: Typecheck ve tarayıcıda doğrula**

Run: `make typecheck && make dev-web`
Tarayıcı: `/properties` → ilgili property'de `social` modülünü etkinleştir (modül seçimi). Sidebar "Mesajlaşma" altında "Sosyal" görünür. `/social`: 5 KPI, grafik, 2 hesaplı tablo. Konsolda hata yok.
Expected: Takipçi değeri Zernio panelindeki ile aynı (Instagram `brand_main`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-social.ts apps/web/src/pages/social/index.tsx apps/web/src/App.tsx apps/web/src/components/layout/index.tsx apps/web/src/components/integrations-panel/index.tsx
git commit -m "feat(web): WES-000 sosyal genel bakis sayfasi ve zernio kurulum akisi"
```

---

### Task 11: Mobil - sosyal ekranı ve giriş noktaları

**Files:**
- Create: `apps/mobile/src/hooks/use-social.ts`
- Create: `apps/mobile/app/(cockpit)/settings/social/_layout.tsx`
- Create: `apps/mobile/app/(cockpit)/settings/social/index.tsx`
- Modify: `apps/mobile/app/(cockpit)/settings/index.tsx:114-142` (Row)
- Modify: `apps/mobile/app/(cockpit)/overview.tsx:296-331` sonrası (karo)

**Interfaces:**
- Consumes: `socialAccountsQueryOptions`, `socialKpisQueryOptions` (Task 9); `usePreferences().selectedPropertyId`; `ScreenGround`, `BentoHeader`, `BentoTile`, `Rise`, `Empty` (`~/components/bento`); `StatTile`, `statFontSize` (`~/components/overview`); `ScreenStatus`; `useT`; `formatInteger` (`~/lib/format`).
- Produces: rota `/settings/social`.

- [ ] **Step 1: Hook'lar**

```ts
// apps/mobile/src/hooks/use-social.ts
import { useQuery } from "@tanstack/react-query";
import { socialAccountsQueryOptions, socialKpisQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { SocialAccount, SocialKpis } from "@helm/api";

export function useSocialAccounts() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(socialAccountsQueryOptions(supabase, selectedPropertyId));
}

export function useSocialKpis(days = 30) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(socialKpisQueryOptions(supabase, selectedPropertyId, days));
}
```

- [ ] **Step 2: Yığın layout'u**

```tsx
// apps/mobile/app/(cockpit)/settings/social/_layout.tsx
import { Stack } from "expo-router";

// Sosyal yigini Ayarlar altinda: kok layout Slot, kok Stack yok; NativeTabs
// altinda sekmesiz rota bu repoda kanitli degil, settings/sources kanitli.
// Alt proje 2-3 buraya posts/, inbox/ ekler.
export default function SocialLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Ekran**

```tsx
// apps/mobile/app/(cockpit)/settings/social/index.tsx
import { Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { press, space, withAlpha } from "@helm/design";

import { useSocialAccounts, useSocialKpis } from "~/hooks/use-social";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { StatTile, statFontSize } from "~/components/overview";
import { ScreenGround, BentoHeader, BentoTile, Empty, Rise } from "~/components/bento";

export default function SocialOverview() {
  const router = useRouter();
  const { theme } = useTheme();
  const t = useT();
  const accounts = useSocialAccounts();
  const kpis = useSocialKpis(30);
  const { refreshing, onRefresh } = useScreenRefresh();

  if (accounts.isLoading || kpis.isLoading) return <ScreenStatus label={t("Sosyal veriler yükleniyor")} />;
  if (accounts.error) return <ScreenStatus label={accounts.error.message} tone="danger" />;

  const list = accounts.data ?? [];
  const k = kpis.data;
  const followers = k?.followers == null ? "-" : formatInteger(k.followers);
  const impressions = k ? formatInteger(k.impressions) : "-";
  const engagements = k ? formatInteger(k.engagements) : "-";
  const statSize = statFontSize([followers, impressions, engagements]);

  return (
    <ScreenGround>
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader eyebrow={t("SOSYAL")} title={t("Hesaplar")} onBack={() => router.back()} />
        <ScrollView
          contentContainerStyle={{ padding: space.screen, gap: space.tileGap }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View className="flex-row gap-tileGap">
            <StatTile index={0} replayKey={0} label={t("TAKİPÇİ")} value={followers} delta={k?.followersDelta} fontSize={statSize} note={followers === "-" ? t("ölçüm yok") : undefined} />
            <StatTile index={1} replayKey={0} label="IMPR." value={impressions} delta={k?.impressionsDelta} fontSize={statSize} />
            <StatTile index={2} replayKey={0} label={t("ETKİLEŞİM")} value={engagements} delta={k?.engagementsDelta} fontSize={statSize} />
          </View>

          <Rise index={3}>
            <BentoTile>
              {list.length === 0 ? (
                <Empty label={t("Bağlı sosyal hesap yok - web'den Zernio'yu bağla")} />
              ) : (
                list.map((a, i) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      if (!a.profile_url) return;
                      haptic.tap();
                      Linking.openURL(a.profile_url);
                    }}
                    style={({ pressed }) => [
                      { flexDirection: "row", alignItems: "center", gap: space.tilePadSm, paddingVertical: space.tilePadSm },
                      i > 0 && { borderTopWidth: 1, borderTopColor: withAlpha(theme.fg3, 0.2) },
                      pressed && press,
                    ]}
                  >
                    {a.avatar_url ? (
                      <Image source={{ uri: a.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    ) : (
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: withAlpha(theme.fg3, 0.2) }} />
                    )}
                    <View className="flex-1">
                      <Text className="font-semibold text-body text-fg">{a.display_name ?? a.username ?? a.id}</Text>
                      <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                        {a.platform.toUpperCase()}{a.username ? ` · @${a.username}` : ""}
                      </Text>
                    </View>
                    <Text className="font-mono-medium text-body text-fg" style={a.needs_reconnection ? { color: theme.neg } : undefined}>
                      {a.needs_reconnection ? t("yeniden bağla") : a.followers_count == null ? "-" : formatInteger(a.followers_count)}
                    </Text>
                  </Pressable>
                ))
              )}
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </ScreenGround>
  );
}
```

`statFontSize`'ın imzası için `apps/mobile/src/components/overview/tiles.tsx`'e bak; parametre `string[]` değilse (`overview.tsx:?` içindeki `statSize` hesaplamasına bak) orada kullanılan biçime uyarla. `space.screen`, `space.tileGap`, `space.tilePadSm` adları `@helm/design`'daki `space` nesnesinde yoksa `overview.tsx`'in `contentContainerStyle`'ında kullanılan adları al.

- [ ] **Step 4: Ayarlar satırı ve Overview karosu**

`settings/index.tsx` içinde "Kaynaklar" `Row`'undan sonra:

```tsx
              <Row
                label={t("Sosyal")}
                sub={t("hesaplar ve etkileşim")}
                divider
                value={socialSummary}
                onPress={() => router.push("/settings/social")}
              />
```

Aynı dosyanın üstüne import ve değer:

```tsx
import { useSocialAccounts } from "~/hooks/use-social";
```

```tsx
  const socialQuery = useSocialAccounts();
  const socialSummary = `${socialQuery.data?.length ?? 0} ${t("hesap")}`;
```

`overview.tsx`'te üç `StatTile`'ı saran `<View className="flex-row gap-tileGap">` bloğundan hemen sonra, yalnızca hesap varsa görünen karo:

```tsx
          {social.data && social.data.length > 0 && (
            <Rise index={4} replayKey={replayKey}>
              <Pressable onPress={() => { haptic.tap(); router.push("/settings/social"); }}>
                <BentoTile>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">{t("SOSYAL")}</Text>
                      <Text className="font-semibold text-title tracking-tighter text-fg">
                        {socialKpis.data?.followers == null ? "-" : formatInteger(socialKpis.data.followers)} {t("takipçi")}
                      </Text>
                    </View>
                    <Text className="font-mono-medium text-eyebrow text-fg3">
                      {social.data.length} {t("hesap")} ›
                    </Text>
                  </View>
                </BentoTile>
              </Pressable>
            </Rise>
          )}
```

`overview.tsx` importlarına:

```tsx
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSocialAccounts, useSocialKpis } from "~/hooks/use-social";
```

ve bileşen gövdesinde (`const kpis = useCockpitKpis();` yakınına):

```tsx
  const router = useRouter();
  const social = useSocialAccounts();
  const socialKpis = useSocialKpis(30);
```

Sonraki `Rise` bileşenlerinin `index` değerleri (4, 5, 6…) bir artırılır ki giriş animasyonu sırası bozulmasın. `Pressable` zaten import edilmişse tekrar ekleme.

- [ ] **Step 5: Typecheck ve cihazda doğrula**

Run: `bun run --cwd apps/mobile typecheck && make dev-mobile`
Simülatör: Overview'de "SOSYAL · N takipçi" karosu görünür, dokununca `/settings/social` açılır; üç stat + 2 hesap. Ayarlar → Sosyal satırı aynı ekrana gider. Kaynaklar → Yeni kaynak listesinde "Zernio" seçilebilir (Task 2'den kendiliğinden gelir), formda API key alanı gizli tipte.
Expected: takipçi değeri web ile aynı.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/hooks/use-social.ts "apps/mobile/app/(cockpit)/settings/social" "apps/mobile/app/(cockpit)/settings/index.tsx" "apps/mobile/app/(cockpit)/overview.tsx"
git commit -m "feat(mobile): WES-000 sosyal hesaplar ekrani ve overview karosu"
```

---

### Task 12: Uçtan uca doğrulama ve doküman

**Files:**
- Modify: `docs/integrations/providers.md` (tablo + Zernio bölümü)

- [ ] **Step 1: Nightly akışını elle koş**

Web → Sistem → "Senkronla" (`helm-ingest` manual). SQL:

```sql
select provider, last_sync_status, last_sync_error from public.project_integrations where provider = 'zernio';
select date, metric, value from public.metrics where source = 'zernio' order by date desc, metric limit 12;
select account_id, date, followers, impressions from public.social_account_daily order by date desc limit 6;
```
Expected: `ok`, hata null; bugün `social_followers`; yayın günlerinde `social_impressions` vb.

- [ ] **Step 2: Webhook canlı testi**

Zernio panelinden (ya da `POST /v1/webhooks/test`) test olayı gönder. Supabase → Edge Functions → `helm-zernio-webhook` logları.
Expected: 200 `{ok:true, event:"webhook.test"}`. 401 ise Task 8 Step 3'teki not uygulanır.

- [ ] **Step 3: Doküman**

`docs/integrations/providers.md` özet tablosuna satır:

```
| `zernio` | API key paste | v1 | nightly + webhook | `metrics` (social_*), `social_accounts`, `social_account_daily` |
```

Dosya sonundaki "Entegrasyon → modül eşlemesi" tablosuna `| social | zernio |`. "İlgili" bölümünden önce yeni bölüm:

```markdown
## Zernio (sosyal)

### credentials
```json
{ "api_key": "sk_...", "profile_id": "opsiyonel 24 hex" }
```
`profile_id` boşsa `isDefault` profil. Hesaplar bu profilden okunur.

### sync (nightly, helm-ingest)
| Zernio | Hub |
|---|---|
| `GET /v1/accounts` | `social_accounts` (upsert id) |
| `GET /v1/analytics` (90 gün, yayın gününe toplanır) | `metrics`: `social_impressions`, `social_reach`, `social_engagements`, `social_posts_published`; `social_account_daily` |
| `accounts[].followersCount` | `metrics.social_followers` (bugün, anlık) |

### webhook
`helm-social` → `webhook.ensure` Zernio'da aboneliği kurar (URL `…/functions/v1/helm-zernio-webhook`, secret `ZERNIO_WEBHOOK_SECRET`). İmza `X-Zernio-Signature` HMAC-SHA256. Alt proje 1 olayları: `webhook.test`, `account.connected`, `account.disconnected`, `analytics.synced`.

### Deploy notu
`helm-zernio-webhook` `--no-verify-jwt` ile deploy edilir; `ZERNIO_WEBHOOK_SECRET` Supabase secrets'ta olmalı.
```

- [ ] **Step 4: Commit**

```bash
git add docs/integrations/providers.md
git commit -m "docs(root): WES-000 zernio saglayici spec'ini providers dokumanina ekle"
```

---

## Self-review

- **Spec kapsamı (alt proje 1):** migration (T1), sağlayıcı kaydı 4 yer + 3 registry (T2, T3, T5), connector (T4, T5), `helm-social` accounts.sync + webhook.ensure (T8), webhook account.* + analytics.synced + webhook.test (T7), web genel bakış + entegrasyon kartı (T3, T10), mobil `social/index` + Overview karosu (T11). Push paylaşımı (T6). `data-coverage` gecikmesi (T3). Doküman (T12). `helm-test`/`helm-verify` eksik kayıtları (T5).
- **Yer tutucu:** yok. Belirsiz iki nokta (imza formülü, `statFontSize` imzası) açıkça "bak ve uyarla" talimatıyla işaretli, gerçek dosya adıyla.
- **Tip tutarlılığı:** `toAccountRows` T4'te tanımlı, T5 ve T8'de aynı imzayla kullanılıyor. `ExtraUpsert.withProjectId` T4 → T5. `invokeSocial` T9 → T10. `sendCockpitPush(hub, title, body, data)` T6 → T7. `SocialKpis` alan adları T9 test, T10, T11'de aynı.
- **Kapsam dışı bırakılan ve sonraki alt projeye giden:** post.* ve message/comment.received olayları webhook'ta 200 ile yutuluyor (T7 yorumu); `WEBHOOK_EVENTS` listesi şimdiden tam ki alt proje 2-3'te Zernio'da aboneliği güncellemek gerekmesin.
