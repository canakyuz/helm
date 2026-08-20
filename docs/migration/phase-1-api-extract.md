# Faz 1 - API Extract

**Süre:** 2–3 hafta  
**Durum:** 🔲 Bekliyor  
**Önkoşul:** [Faz 0](./phase-0-scaffold.md) tamamlanmış  
**Çıktı:** Mobile hook'lar thin wrapper; fetch logic `@helm/api`'de.

## Amaç

Web/mobile drift'i önlemek için tüm `supabase.from(...)` çağrılarını hook'lardan çıkar.

## Extract sırası

Risk ve bağımlılığa göre - **bu sırayı değiştirme**:

| # | Kaynak | Hedef paket | Not |
|---|--------|-------------|-----|
| 1 | `src/lib/format.ts` | `@helm/domain/format` | Saf fn, Supabase yok |
| 2 | `src/lib/modules.ts` | `@helm/domain/modules` | `CockpitKpis` type import → `@helm/api` |
| 3 | `use-fx-rates` | `@helm/api/fx-rates` | Basit, izole |
| 4 | `use-property-list` | `@helm/api/property-list` | Basit |
| 5 | `use-cockpit-kpis` | `@helm/api/cockpit-kpis` | Core - dikkatli test |
| 6 | `use-alerts` + `useAckAlert` | `@helm/api/alerts` | Mutation ayrı export |
| 7 | `use-properties` | `@helm/api/properties` | Heartbeat logic domain'e |
| 8 | `use-system-health` | `@helm/api/system-health` | `deriveStatus` → domain |
| 9 | `use-audit` | `@helm/api/audit` | |
| 10 | `use-reviews` + `useReviewReply` | `@helm/api/reviews` | Reply = mutation |
| 11 | `use-users` + `use-property-dau` | `@helm/api/users` | Supabase integration check |
| 12 | `use-sentry-issues` | `@helm/api/sentry-issues` | |
| 13 | `use-app-versions` | `@helm/api/app-versions` | |
| 14 | `use-metric-detail` | `@helm/api/metric-detail` | |
| 15 | `use-projects-breakdown` | `@helm/api/projects-breakdown` | |
| 16 | `use-segments` | `@helm/api/segments` | |
| 17 | `use-segment-template-counts` | `@helm/api/segment-metrics` | User fetch overlap users.ts |
| 18 | `use-property-metric-totals` | `@helm/api/property-metric-totals` | |

**Extract edilmez (platform-only):**

- `use-auth` - SecureStore adapter
- `use-widget-sync` - iOS widget bridge
- `use-format-currency` - prefs hook; domain `formatCurrency` kullanır

## PR stratejisi

Her extract **ayrı PR** (review kolay, rollback güvenli):

```
refactor(api): WES-XXX extract fetchPropertyList to @helm/api
refactor(mobile): WES-XXX thin wrapper usePropertyList
```

PR başına max 2 api modülü (cockpit-kpis tek başına bir PR).

## Tek PR checklist

- [ ] `packages/api/src/<module>.ts` - fetch + types export
- [ ] `packages/queries/src/<module>.ts` - queryKeys + queryOptions (+ mutationOptions)
- [ ] `apps/mobile/src/hooks/use-*.ts` - sadece useQuery/useMutation wrapper
- [ ] `bun typecheck` yeşil
- [ ] Smoke: ilgili ekran açılıyor, data geliyor

## Query key convention

```typescript
export const alertsKeys = {
  all: ["alerts"] as const,
  list: (propertyId: string) => [...alertsKeys.all, "list", propertyId] as const,
};
```

Mutation invalidate:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: alertsKeys.all });
};
```

## Stale time (@helm/config)

```typescript
export const STALE_TIME = {
  kpis: 30_000,
  alerts: 30_000,
  audit: 300_000,
  systemHealth: 60_000,
  fxRates: 3_600_000,
} as const;
```

## Test (manuel smoke matrix)

| Ekran | Hook | Kontrol |
|-------|------|---------|
| Home | `useCockpitKpis` | MRR, DAU, alert count |
| Alerts | `useAlerts`, ack | Liste + ack sonrası refresh |
| System | `useSystemHealth` | Provider grupları, sync run |
| Reviews | `useReviews` | Filter + histogram |
| Properties | `useProperties` | Heartbeat status |
| Audit | `useAudit` | Son 100 entry |

## Definition of Done

- [ ] Mobile `src/hooks/*.ts` içinde **sıfır** `supabase.from`
- [ ] `@helm/api` tüm fetch fonksiyonlarını export ediyor
- [ ] `@helm/queries` tüm consumer-facing queryOptions export ediyor
- [ ] `bun typecheck` monorepo geneli yeşil
- [ ] Smoke matrix tamamlanmış

## Sonraki faz

→ [overview.md](./overview.md) Faz 2

## İlgili

- [hook-inventory.md](./hook-inventory.md)
