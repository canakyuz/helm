# ADR-001: Monorepo + Shared Packages (Tek UI Değil)

**Durum:** Kabul edildi  
**Tarih:** 2026-05-29  
**Bağlam:** Web (Refine) + mobile (Expo) aynı Supabase hub'a bağlanıyor; ticarileştirme planlanıyor.

## Karar

Helm web ve mobile **tek codebase birleştirilmeyecek**. Bunun yerine:

- **Monorepo:** `apps/web`, `apps/mobile`, `packages/*`
- **Paylaşılan:** `@helm/api`, `@helm/queries`, `@helm/types`, `@helm/domain`
- **Ayrı:** UI, routing, native modüller (widget, SecureStore)

## Alternatifler

| Alternatif | Red nedeni |
|------------|------------|
| Expo Web tek app | Refine admin mobile UX'e sığmaz; bundle şişer |
| Tamamen ayrı repo + npm publish | Revizyon drift; CI karmaşık |
| Mobile'ı PWA yap, native bırak | iOS widget + lock screen kaybı |
| Web'i React Native Web | Refine port maliyeti çok yüksek |

## Sonuçlar

**Artı:**
- Metric/alert değişikliği tek PR
- Type-safe hub contract
- Web kurulum, mobile sahada - doğru UX ayrımı

**Eksi:**
- Monorepo tooling kurulumu (Faz 0)
- İlk extract işi (~2–3 hf)

## İlgili dokümanlar

- [monorepo.md](../monorepo.md)
- [phase-1-api-extract.md](../../migration/phase-1-api-extract.md)
