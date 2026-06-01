# Fiyatlandırma ve Plan Limitleri

## Plan tablosu

| Plan | Fiyat | Property | Integration | Sync sıklığı | Mobile |
|------|-------|----------|-------------|--------------|--------|
| **Free** | $0 | 1 | 2 | daily | read-only |
| **Founder** | $19/mo | 3 | 5 | 6 saat | full + widget |
| **Studio** | $49/mo | 10 | unlimited | hourly | full + widget |
| **Agency** | $99/mo | 25 | unlimited | hourly + webhooks | 3 seat |

Yıllık ödeme: **2 ay bedava** (~17% indirim). Founding member ayrı — aşağıda.

## Founding member (ilk 50 kullanıcı)

| Özellik | Detay |
|---------|-------|
| İndirim | **%50 lifetime** (Solex modeli) |
| Örnek | Studio $49 → $24.50/mo süresiz |
| Ekstra | Founder onboarding call, roadmap influence, priority support |
| Cap | 50 kişi — sonra kapanır |

## Limit enforcement (teknik)

Plan limitleri hub + worker'da enforce:

```typescript
// packages/config/plans.ts
export const PLANS = {
  free: { properties: 1, integrations: 2, syncIntervalMs: 86_400_000 },
  founder: { properties: 3, integrations: 5, syncIntervalMs: 21_600_000 },
  studio: { properties: 10, integrations: Infinity, syncIntervalMs: 3_600_000 },
  agency: { properties: 25, integrations: Infinity, syncIntervalMs: 3_600_000 },
} as const;
```

- Property create → `org.plan` check
- Integration enable → count check
- Worker cron → `sync_schedule` plan'a göre

## Billing stack

| Bileşen | Araç |
|---------|------|
| Checkout | Stripe Checkout |
| Portal | Stripe Customer Portal |
| Webhook | `customer.subscription.updated` → `organizations.plan` |
| Mobile IAP | **Önerilmez v1** — web subscription bundle |

Mobile App Store'da sunulacaksa fiyat Apple cut (%15–30) hesaba katılır.

## Feature matrix

| Feature | Free | Founder | Studio | Agency |
|---------|------|---------|--------|--------|
| KPI dashboard | ✓ | ✓ | ✓ | ✓ |
| Alerts (view) | ✓ | ✓ | ✓ | ✓ |
| Alert ack | — | ✓ | ✓ | ✓ |
| iOS widget | — | ✓ | ✓ | ✓ |
| Review reply | — | ✓ | ✓ | ✓ |
| Audit log | — | ✓ | ✓ | ✓ |
| Segment edit | — | — | ✓ | ✓ |
| Webhooks | — | — | ✓ | ✓ |
| API access | — | — | v1.1 | ✓ |
| Seats | 1 | 1 | 1 | 3 |

## Upgrade path

```
Free → Founder: widget + alert ack unlock
Founder → Studio: property 4–10, hourly sync
Studio → Agency: 11–25 property, team seats
```

In-app upgrade CTA: mobile settings + web billing page.

## Gelir hedefleri (plan mix tahmini)

Orta senaryo ay 12 — 200 paid user:

| Plan | % mix | Users | MRR |
|------|-------|-------|-----|
| Founder | 55% | 110 | $2,090 |
| Studio | 35% | 70 | $3,430 |
| Agency | 10% | 20 | $1,980 |
| **Toplam** | | **200** | **~$7,500** |

Blended ARPU ~$37 (agency mix ile master doc'taki $32'nin üstü).

## İlgili

- [market-and-revenue.md](./market-and-revenue.md)
- [../integrations/providers.md](../integrations/providers.md) — sync frequency
