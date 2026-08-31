# Faz 0 - Monorepo Scaffold

**Süre:** ~1 hafta  
**Durum:** 🔲 Bekliyor  
**Çıktı:** Boş `packages/*`, mobile build yeşil, types tek kaynak.

## Amaç

Kod taşımadan önce monorepo iskeletini kur. Faz 1'de extract edilecek paketlerin yerini hazırla.

## Önkoşullar

- [ ] `helm` web repo path'i netleşmiş (monorepo'ya taşınacak mı, sonra mı?)
- [ ] `HELM_SUPABASE_PROJECT_ID` `.env`'de tanımlı
- [ ] `supabase login` yapılmış (types generate için)

## Adım 1 - Monorepo root kararı

**Seçenek A (önerilen):** Yeni `helm/` root; `helm-mobile` → `apps/mobile`, web → `apps/web`.

**Seçenek B (geçici):** `helm-mobile` içinde `packages/` başlat; web sonra gelir.

Bu doküman **Seçenek A** varsayar. Seçenek B için sadece `apps/mobile` yerine repo root kullan.

## Adım 2 - Dizin oluştur

```bash
# Yeni root (Seçenek A)
mkdir -p helm/{apps/mobile,packages/{types,api,queries,domain,config}/src}
```

Mevcut `helm-mobile` içeriği `apps/mobile/` altına taşınır (git history için `git subtree` veya yeni repo).

## Adım 3 - Root package.json

```json
{
  "name": "helm",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "typecheck": "bun run --filter '*' typecheck",
    "gen:types": "supabase gen types typescript --project-id $HELM_SUPABASE_PROJECT_ID --schema public > packages/types/src/database.ts"
  }
}
```

## Adım 4 - Paket iskeletleri

Her paket minimum:

```
packages/types/
├── package.json      # name: @helm/types
├── tsconfig.json
└── src/
    └── index.ts

packages/api/
├── package.json      # deps: @helm/types, @supabase/supabase-js
└── src/
    └── index.ts      # boş export

packages/queries/
├── package.json      # deps: @helm/api, @tanstack/react-query
└── src/
    └── index.ts

packages/domain/
├── package.json
└── src/
    └── index.ts

packages/config/
├── package.json
└── src/
    └── stale-time.ts
```

`packages/types/package.json`:

```json
{
  "name": "@helm/types",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

## Adım 5 - Types generate

```bash
cd helm
export HELM_SUPABASE_PROJECT_ID=<your-project-ref>  # .env'den
bun run gen:types
```

Placeholder `database.ts` yerine gerçek schema gelmeli.

Ek domain types (`SelectedPropertyId`, `ModuleId`) `packages/types/src/domain.ts`'e taşınacak (Faz 1).

## Adım 6 - Mobile workspace bağlantısı

`apps/mobile/package.json`:

```json
{
  "dependencies": {
    "@helm/types": "workspace:*",
    "@helm/api": "workspace:*",
    "@helm/queries": "workspace:*",
    "@helm/domain": "workspace:*",
    "@helm/config": "workspace:*"
  }
}
```

Faz 0'da mobile **henüz import etmez** - sadece dependency tanımlı, build kırılmaz.

## Adım 7 - CI

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck
```

Mobile için mevcut `bun typecheck` (`tsc --noEmit`) korunur.

## Adım 8 - Web repo audit (paralel)

Web repo henüz taşınmamış olsa bile:

- [ ] Web'de Supabase query yapan dosyaları listele
- [ ] Mobile [hook-inventory.md](./hook-inventory.md) ile karşılaştır
- [ ] Duplicate / overlap tablosu çıkar (Faz 2 input)

Audit şablonu:

| Domain | Mobile hook | Web dosya (path) | Overlap |
|--------|-------------|------------------|---------|
| KPI | `use-cockpit-kpis` | TBD | - |
| Alerts | `use-alerts` | TBD | - |
| ... | ... | ... | ... |

## Adım 9 - Kurallar (feature freeze)

Faz 0 bitince:

1. **Yeni fetch logic** doğrudan `packages/api`'ye yazılır - mobile hook'a gömülmez.
2. **Schema değişikliği** → `gen:types` → PR'da types diff review.
3. **Commit scope:** `mobile`, `web`, `api`, `docs` (conventional + WES-XXX).

## Definition of Done

- [ ] Monorepo workspaces resolve (`bun install` hatasız)
- [ ] `packages/types` gerçek `database.ts` içeriyor
- [ ] `apps/mobile` `bun typecheck` yeşil
- [ ] CI yeşil
- [ ] Web duplicate audit tablosu başlatılmış (path'ler TBD olabilir)
- [ ] [hook-inventory.md](./hook-inventory.md) review edildi

## Sonraki faz

→ [phase-1-api-extract.md](./phase-1-api-extract.md)

## İlgili

- [monorepo.md](../architecture/monorepo.md)
- [ADR-001](../architecture/decisions/001-monorepo-shared-packages.md)
