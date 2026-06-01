# Helm Docs

Helm'i ticari birleşik ürüne (web + mobile + hosted hub) taşıma planı.

## Hızlı başlangıç

| Sıra | Doküman | Ne zaman oku |
|------|---------|--------------|
| 1 | [HELM_PRODUCT_STRATEGY.md](./HELM_PRODUCT_STRATEGY.md) | Büyük resim — vizyon, özet, kararlar |
| 2 | [migration/phase-0-scaffold.md](./migration/phase-0-scaffold.md) | **İlk uygulama adımı** — monorepo iskelet |
| 3 | [migration/hook-inventory.md](./migration/hook-inventory.md) | Mobile hook → `@helm/api` eşlemesi |
| 4 | [integrations/architecture.md](./integrations/architecture.md) | Otomatik sync + adapter mimarisi |

## Dizin

### Strateji

- [HELM_PRODUCT_STRATEGY.md](./HELM_PRODUCT_STRATEGY.md) — master belge (executive summary + tüm bölümler)

### Mimari

- [architecture/monorepo.md](./architecture/monorepo.md) — repo yapısı, paket kuralları, import sınırları
- [architecture/decisions/001-monorepo-shared-packages.md](./architecture/decisions/001-monorepo-shared-packages.md) — ADR: neden tek UI değil

### Geçiş planı

- [migration/overview.md](./migration/overview.md) — 6 faz timeline + bağımlılık grafiği
- [migration/phase-0-scaffold.md](./migration/phase-0-scaffold.md) — monorepo + CI + types
- [migration/phase-1-api-extract.md](./migration/phase-1-api-extract.md) — `@helm/api` extract sırası
- [migration/hook-inventory.md](./migration/hook-inventory.md) — mobile hook envanteri (kod tabanlı)

### Entegrasyonlar

- [integrations/architecture.md](./integrations/architecture.md) — sync orchestration, schema, adapter interface
- [integrations/providers.md](./integrations/providers.md) — provider başına connect/sync spec

### İş / pazar

- [business/market-and-revenue.md](./business/market-and-revenue.md) — TAM/SAM/SOM, rakipler, gelir senaryoları
- [business/pricing.md](./business/pricing.md) — planlar, limitler, founding member

## Durum

| Faz | Durum | Doküman |
|-----|-------|---------|
| 0 — Scaffold | 🔲 Bekliyor | [phase-0](./migration/phase-0-scaffold.md) |
| 1 — API extract | 🔲 Bekliyor | [phase-1](./migration/phase-1-api-extract.md) |
| 2 — Web adopt | 🔲 Bekliyor | [overview](./migration/overview.md) |
| 3 — Multi-tenant | 🔲 Bekliyor | [overview](./migration/overview.md) |
| 4 — Integrations MVP | 🔲 Bekliyor | [providers](./integrations/providers.md) |
| 5 — Launch | 🔲 Bekliyor | [pricing](./business/pricing.md) |

Son güncelleme: 2026-05-29
