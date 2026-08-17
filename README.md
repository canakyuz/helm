# Helm

Indie founder **portfolio operations hub** — birden fazla app/property'nin gelir, kullanıcı, crash ve review metriklerini tek yerden izle. Web (kurulum + derin admin) ve mobil (sahada KPI + alert + iOS widget) **aynı Supabase hub'a** bağlanır.

> Tek ürün, iki kabuk, paylaşılan veri katmanı — tek UI değil. Bkz [ADR-001](./docs/architecture/decisions/001-monorepo-shared-packages.md).

## Yapı

```
helm/                       bun workspaces monorepo
├── apps/
│   ├── web/                Refine + Vite — admin, entegrasyon wizard, billing
│   └── mobile/             Expo (SDK 56) — KPI/alert/widget, TestFlight
├── packages/               @helm/* — apps arası paylaşılan katman (Faz 1'de dolar)
│   ├── types/              Supabase Database + domain tipleri (tek kaynak)
│   ├── api/                saf fetch fonksiyonları (supabase.from)
│   ├── queries/            TanStack queryOptions + keys
│   ├── domain/             format, severity, modules
│   └── config/             staleTime, plan limitleri
├── supabase/               migrations + edge functions (her iki app paylaşır)
└── docs/                   strateji, mimari, geçiş planı
```

## Kurulum

```bash
bun install
make hooks   # pre-commit sır taraması — clone sonrası bir kez
# .env: HELM_SUPABASE_PROJECT_ID + app'lerde EXPO_PUBLIC_* / VITE_* anahtarları
```

Anahtarlar `.env`'de durur, `.env.example` sadece placeholder içerir. Gerçek bir
credential stage'lersen `pre-commit` commit'i durdurur; aynı tarama CI'da da koşar.

## Komutlar (`make help`)

| Komut | Ne yapar |
|-------|----------|
| `make dev-web` | Web cockpit (Refine/Vite) |
| `make dev-mobile` | Mobil (Expo, cache temiz) |
| `make typecheck` | Tüm workspace'leri `tsc` |
| `make build-web` | Web prod build → `apps/web/dist` |
| `make gen-types` | Supabase schema → `packages/types/src/database.ts` |
| `make db-push` | Migration'ları remote'a uygula |
| `make fn-deploy FN=helm-payouts` | Edge function deploy (FN'siz hepsi) |
| `make ios-release` | Yerel IPA + TestFlight (`apps/mobile/Makefile`) |
| `make clean` | node_modules + build temizle |

## Backend (Supabase)

- Proje: `mqiwgorivtglnjbwhkve`. Migration'lar `supabase/migrations/`, edge'ler `supabase/functions/`.
- Connector'lar `helm-ingest` içinde; saatlik cron tüm enabled entegrasyonu senkronlar.
- Metrik şeması generic (`metrics: project_id,date,source,metric,value`) → yeni metrik = yeni `metric` string + onu yazan connector.

## Dağıtım

- **Web:** `make build-web` → statik `dist/` (kendi sunucu/Caddy + auth duvarı; tek-kullanıcı, RLS permissive).
- **Mobil:** `make ios-release` (yerel EAS build → TestFlight; cloud quota yemez).

## Dokümanlar

- [docs/README.md](./docs/README.md) — doküman indeksi
- [docs/architecture/monorepo.md](./docs/architecture/monorepo.md) — paket kuralları, import yönü
- [docs/integrations/architecture.md](./docs/integrations/architecture.md) — sync orchestration, adapter interface
- [docs/migration/](./docs/migration/) — geçiş fazları
- [MONOREPO-EXECUTION.md](./MONOREPO-EXECUTION.md) — Faz 0 kurulum spec'i (uygulandı)

## Katkı ve güvenlik

- [CONTRIBUTING.md](./CONTRIBUTING.md) — geliştirme akışı, commit formatı, PR beklentileri
- [SECURITY.md](./SECURITY.md) — açık bildirimi

## Lisans

[GNU AGPL-3.0](./LICENSE). Helm'i değiştirip ağ üzerinden bir servis olarak
sunuyorsan, değiştirdiğin kaynağı kullanıcılarına açmak zorundasın. Bu şartın
uymadığı bir kullanım için ayrı lisans konusunda yazabilirsin.

## Durum

- **Faz 0 (monorepo iskelet)** ✅ — workspaces, `@helm/*` scaffold, types tek kaynak, build yeşil.
- **Faz 1 (API extract)** 🔲 — hook'lardaki `supabase.from` → `@helm/api`. Sıra: [phase-1-api-extract.md](./docs/migration/phase-1-api-extract.md). Şu an app'ler `@helm/*`'ı henüz import etmiyor (sadece dep tanımlı).
