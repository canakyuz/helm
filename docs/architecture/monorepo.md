# Monorepo Mimarisi

## Hedef dizin yapısı

```
helm/
├── apps/
│   ├── web/                 # Refine cockpit - entegrasyon, admin, billing
│   └── mobile/              # Expo - KPI, alerts, widget (mevcut helm-mobile)
├── packages/
│   ├── types/               # Database + domain types (@helm/types)
│   ├── api/                 # Saf fetch fonksiyonları (@helm/api)
│   ├── queries/             # TanStack queryOptions + keys (@helm/queries)
│   ├── domain/              # format, modules, severity (@helm/domain)
│   └── config/              # staleTime, plan limits (@helm/config)
├── supabase/
│   ├── migrations/
│   ├── functions/           # oauth-callback, sync-trigger
│   └── seed/
├── workers/                 # Provider sync adapters (Bun)
├── docs/
└── package.json             # bun workspaces
```

## Paket kuralları

| Paket | İçerir | İçermez |
|-------|--------|---------|
| `@helm/types` | `Database`, row types, enums | React, Supabase client instance |
| `@helm/api` | `fetchCockpitKpis(client, opts)` | `useQuery`, hooks, UI |
| `@helm/queries` | `queryOptions`, `queryKeys` | Platform storage, SecureStore |
| `@helm/domain` | `deriveSeverity`, `TILE_REGISTRY`, `formatCurrency` | `supabase.from` |
| `@helm/config` | `STALE_TIME.kpis = 30_000` | Business logic |
| `apps/*` | Thin hooks, screens, native | Inline `supabase.from` in hooks |

## Import yönü (tek yönlü)

```
apps/web     ──┐
               ├──► @helm/queries ──► @helm/api ──► @helm/types
apps/mobile  ──┘              └──► @helm/domain
                                        └──► @helm/config
```

`@helm/api` **asla** `@helm/queries` import etmez.

## Extract pattern

```typescript
// packages/api/src/cockpit-kpis.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/types";
import type { SelectedPropertyId } from "@helm/types/preferences";

export type CockpitKpis = { /* ... */ };

export async function fetchCockpitKpis(
  client: SupabaseClient<Database>,
  propertyId: SelectedPropertyId,
): Promise<CockpitKpis> {
  // supabase.from("metrics") ...
}
```

```typescript
// packages/queries/src/cockpit-kpis.ts
import { queryOptions } from "@tanstack/react-query";
import { fetchCockpitKpis } from "@helm/api/cockpit-kpis";
import { STALE_TIME } from "@helm/config";

export const cockpitKpisKeys = {
  all: ["cockpit-kpis"] as const,
  byProperty: (id: string) => [...cockpitKpisKeys.all, id] as const,
};

export function cockpitKpisQueryOptions(client, propertyId) {
  return queryOptions({
    queryKey: cockpitKpisKeys.byProperty(propertyId),
    queryFn: () => fetchCockpitKpis(client, propertyId),
    staleTime: STALE_TIME.kpis,
  });
}
```

```typescript
// apps/mobile/src/hooks/use-cockpit-kpis.ts (~15 satır)
import { useQuery } from "@tanstack/react-query";
import { cockpitKpisQueryOptions } from "@helm/queries/cockpit-kpis";
import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export function useCockpitKpis() {
  const { propertyId } = usePreferences();
  return useQuery(cockpitKpisQueryOptions(supabase, propertyId));
}
```

## Platform sınırları

### Web-only

- Integration wizard (OAuth redirect, credential form)
- Refine data provider + bulk CRUD
- Stripe Customer Portal
- Org / team invite

### Mobile-only

- `useWidgetSync`, App Group, WidgetKit Swift
- Haptics, bottom sheets, FlashList
- `expo-secure-store` auth adapter
- Push notifications (v2)

### Shared UI primitives (opsiyonel v2)

İlk fazda **paylaşılmaz**. Token isimleri (`bg-surface-1`) aynı kalır; component library sonra değerlendirilir.

## Workspace config (hedef)

```json
{
  "name": "helm",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

```json
// apps/mobile/package.json
{
  "dependencies": {
    "@helm/api": "workspace:*",
    "@helm/queries": "workspace:*",
    "@helm/types": "workspace:*",
    "@helm/domain": "workspace:*"
  }
}
```

## CI (hedef)

```yaml
# .github/workflows/ci.yml
jobs:
  typecheck:
    steps:
      - run: bun install
      - run: bun run typecheck --filter=@helm/types
      - run: bun run typecheck --filter=@helm/api
      - run: bun run typecheck --filter=mobile
      - run: bun run typecheck --filter=web
```

## İlgili

- [ADR-001](./decisions/001-monorepo-shared-packages.md)
- [hook-inventory.md](../migration/hook-inventory.md)
