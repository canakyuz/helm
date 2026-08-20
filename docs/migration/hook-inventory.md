# Mobile Hook Envanteri

> Kaynak: `helm-mobile/src/hooks/` - 2026-05-29  
> Faz 1 extract için referans tablo.

## Özet

| Kategori | Adet |
|----------|------|
| Data hooks (extract) | 18 |
| Platform-only | 3 |
| **Toplam** | 21 |

## Data hooks - extract hedefi

| Hook dosyası | Fetch fn | Hub tabloları | `@helm/api` modül | Mutations |
|--------------|----------|---------------|-------------------|-----------|
| `use-cockpit-kpis.ts` | `fetchCockpitKpis`, `fetchMrrSpark`, `fetchTotalRevenueSpark` | `metrics`, `alert_events`, `sync_runs` | `cockpit-kpis.ts` | - |
| `use-alerts.ts` | `fetchAlerts` | `alert_events`, `alert_rules` | `alerts.ts` | `ackAlert` |
| `use-properties.ts` | `fetchProperties` | `properties`, `brands`, `heartbeats` | `properties.ts` | - |
| `use-property-list.ts` | `fetchPropertyList` | `properties` | `property-list.ts` | - |
| `use-reviews.ts` | `fetchReviews` | `reviews` | `reviews.ts` | - |
| `use-review-reply.ts` | - | App Store API via hub | `reviews.ts` | `submitReviewReply` |
| `use-system-health.ts` | `fetchHealth` | `project_integrations`, `sync_runs` | `system-health.ts` | - |
| `use-audit.ts` | `fetchAudit` | audit table (hook içinde) | `audit.ts` | - |
| `use-users.ts` | `fetchAllUsers`, `fetchUsersForProperty` | `project_integrations`, edge fn | `users.ts` | - |
| `use-property-dau.ts` | `fetchPropertyDau`, `fetchUsers` | `properties`, integrations | `users.ts` veya `property-dau.ts` | - |
| `use-sentry-issues.ts` | `fetchIssues`, `fetchPropertyMap` | properties + sentry | `sentry-issues.ts` | - |
| `use-app-versions.ts` | `fetchVersions` | app metadata | `app-versions.ts` | - |
| `use-metric-detail.ts` | `fetchDetail` | `metrics` | `metric-detail.ts` | - |
| `use-projects-breakdown.ts` | `fetchBreakdown` | `metrics`, `properties` | `projects-breakdown.ts` | - |
| `use-segments.ts` | `fetchSegments` | segments table | `segments.ts` | - |
| `use-segment-template-counts.ts` | `fetchAllUsers`, `fetchUsersForProperty` | integrations + auth users | `segment-metrics.ts` | - |
| `use-property-metric-totals.ts` | `fetchTotals` | `metrics` | `property-metric-totals.ts` | - |
| `use-fx-rates.ts` | `fetchRates` | external / hub fx | `fx-rates.ts` | - |

## Platform-only - extract yok

| Hook | Neden |
|------|-------|
| `use-auth.ts` | SecureStore session adapter |
| `use-widget-sync.ts` | iOS App Group + native bridge |
| `use-format-currency.ts` | `usePreferences` + domain formatter |

## Domain helpers (Faz 1 başında taşınır)

| Kaynak | Hedef | Fonksiyonlar |
|--------|-------|--------------|
| `src/lib/format.ts` | `@helm/domain/format` | `formatCurrency`, `formatRelativeTime`, `formatInteger` |
| `src/lib/modules.ts` | `@helm/domain/modules` | `TILE_REGISTRY`, `tilesForModules` |
| `use-alerts.ts` | `@helm/domain/alerts` | `deriveSeverity` |
| `use-system-health.ts` | `@helm/domain/integrations` | `deriveStatus` |
| `use-properties.ts` | `@helm/domain/properties` | `deriveStatus` (heartbeat) |

## Provider enum (hub contract)

Mobile `use-system-health.ts` ve `system.tsx` ile uyumlu:

```typescript
type ProviderName =
  | "revenuecat"
  | "admob"
  | "posthog"
  | "supabase"
  | "rest"
  | "sentry"
  | "appstoreconnect"
  | "resend";
```

## Hub tabloları (mobile'dan infer)

| Tablo | Kullanan hook'lar |
|-------|-------------------|
| `properties` | properties, property-list, users, dau, breakdown |
| `metrics` | cockpit-kpis, metric-detail, breakdown, totals |
| `alert_events` | alerts, cockpit-kpis |
| `alert_rules` | alerts |
| `reviews` | reviews |
| `project_integrations` | system-health, users, dau, segment-metrics |
| `sync_runs` | cockpit-kpis, system-health |
| `brands` | properties |
| `heartbeats` | properties |

> **Not:** `src/types/database.ts` şu an placeholder. Faz 0 `gen:types` sonrası bu tablo doğrulanmalı.

## Web overlap (TBD)

Web repo path netleşince doldur:

| `@helm/api` modül | Mobile | Web dosya | Durum |
|-------------------|--------|-----------|-------|
| `cockpit-kpis` | ✓ | TBD | 🔲 |
| `alerts` | ✓ | TBD | 🔲 |
| `properties` | ✓ | TBD | 🔲 |
| ... | | | |

## İlgili

- [phase-1-api-extract.md](./phase-1-api-extract.md)
- [integrations/architecture.md](../integrations/architecture.md)
