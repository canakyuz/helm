# Pazar Analizi ve Gelir Tahmini

> Tahminler — garanti değil. Kaynaklar ve varsayımlar aşağıda.

## TAM / SAM / SOM

| Katman | Tanım | Büyüklük |
|--------|-------|----------|
| **TAM** | Global app analytics & measurement | ~$3.2B (2024), CAGR ~23% → ~$32B (2035) |
| **SAM** | Indie/solo multi-app revenue + ops cockpit | ~$150M–400M (tahmin) |
| **SOM** | 24 ay ulaşılabilir (EN + TR indie dev) | ~$500K–2M ARR potansiyel |

**TAM kaynağı:** [Market Research Future — App Analytics Market](https://www.marketresearchfuture.com/reports/app-analytics-market-6602)

**SAM hesabı:** TAM'ın ~5–12%'si — subscription analytics (Baremetrics, ChartMogul) + indie dashboard (Solex, AppWatch, Abner) kesişimi.

## Hedef müşteri (ICP)

**Primary:** Solo indie iOS/Android dev, 2–8 app, RevenueCat veya IAP, toplam $2K–50K MRR.

**Secondary:** 2–5 kişilik mini stüdyo, aynı portföy ihtiyacı.

**Anti-ICP:** Enterprise SaaS (Baremetrics yeterli), tek app hobbyist (free tier yeter).

## Rakip haritası

| Ürün | Odak | Fiyat | Helm farkı |
|------|------|-------|------------|
| [Solex](https://www.solex.dev/) | Solo founder cockpit | $15–29/mo | Widget, alert ack, review reply, sync health |
| [AppWatch](https://appwatch.dev/) | Multi-store indie | €19–49/mo | Subscription derinliği, ops modülleri |
| [Abner](https://www.abner.app/) | Dev solopreneur P&L | ~$20–40/mo | Mobile-native, app ops |
| [Baremetrics](https://baremetrics.com/) | SaaS MRR/churn | $75–1152/mo | App store + ads + mobile widget |
| [ChartMogul](https://chartmogul.com/) | Subscription analytics | $100–400+/mo | Indie-friendly değil |
| [SaneSales](https://sanesales.com/) | Native Mac sales | $24.99 one-time | Portfolio hub değil |
| Geckoboard | TV dashboard | $175+/mo | Kurulum ağır |

**En yakın rakip:** Solex — fiyat baskısı ve feature parity riski.

**Helm moat:** multi-property + unified alerts + iOS widget + in-app review reply + integration health transparency.

## Helm diferansiyasyonu

1. Portfolio cockpit (5+ app tek ekran)
2. Alert ack mobilde tek tap
3. App Store review reply in-app
4. iOS home + lock screen widget
5. Sync health (`system.tsx` — 8 provider)
6. Audit trail (mini ekip)

## Gelir varsayımları

| Varsayım | Değer |
|----------|-------|
| Blended ARPU (paid) | ~$32/mo |
| Free → paid conversion | 8–15% |
| Monthly churn (paid) | 5–8% |
| CAC (organik ağırlıklı) | $15–40 |
| LTV (12 ay) | $280–450 |

## 24 ay senaryoları

| Metrik | Konservatif | Orta | İyimser |
|--------|-------------|------|---------|
| Ay 6 paid users | 25 | 60 | 150 |
| Ay 12 paid users | 80 | 200 | 500 |
| Ay 24 paid users | 180 | 550 | 1,400 |
| **Ay 12 MRR** | $2,000 | $6,400 | $16,000 |
| **Ay 24 MRR** | $4,500 | $17,600 | $44,800 |
| **Ay 24 ARR** | $54K | $211K | $538K |

## Zaman → gelir (orta senaryo)

| Dönem | MRR |
|-------|-----|
| Ay 1–3 | $0 (build + beta) |
| Ay 4–6 | $300–800 (founding members) |
| Ay 7–12 | $2K–8K (launch + word of mouth) |
| Ay 13–24 | $8K–20K (SEO + partnerships) |

## Maliyet yapısı (~200 paid user)

| Kalem | Aylık |
|-------|-------|
| Supabase Pro + compute | $75–250 |
| Sync worker (Fly/Railway) | $50–150 |
| EAS + Apple Dev | $30–100 |
| Stripe (~3% MRR) | değişken |
| Domain, email | ~$30 |
| **Toplam infra** | **$200–500** |

**Break-even:** ~15–20 paid user @ $32 ARPU → **$480–640 MRR**

## Dağıtım kanalları

| Kanal | CAC | Not |
|-------|-----|-----|
| Twitter/X build in public | Düşük | Primary |
| Product Hunt | Orta | Launch spike |
| RevenueCat community | Düşük | Integration partnership |
| App Store search | Orta | "app revenue dashboard" |
| SEO long-tail | Düşuk (yavaş) | "RevenueCat dashboard alternative" |

## Upside / downside

**Upside:** RevenueCat partner listing, Agency plan ($99), AI insights add-on (+$10/mo)

**Downside:** Solex fiyat baskısı, ASC API değişiklikleri, sync reliability → churn, solo support yükü

## Net cevaplar

| Soru | Cevap |
|------|-------|
| Side income ($2–5K/mo)? | 12–18 ay, orta execution — **mümkün** |
| Full-time ($15K+/mo)? | 500+ paid, 24+ ay — **zor ama mümkün** |
| VC-scale ($1M+ ARR)? | Düşük öncelik — bootstrap uygun |
| Mobile-only store? | **Hayır** — hub + entegrasyon olmadan anlamsız |

## İlgili

- [pricing.md](./pricing.md)
- [../HELM_PRODUCT_STRATEGY.md](../HELM_PRODUCT_STRATEGY.md)
