# helm-mobile - Gerçek Veri Denetimi + Plan

_2026-05-30 · WES-000 · 5 ekranın gerçek/demo veri durumu + wiring planı_

## Mevcut gerçek kaynaklar (kanıt: hook'lar)

**`metrics` tablosu** (zaman serili, `project_id` boyutlu) - yalnızca şu anahtarlar:
`mrr · dau · total_users · ad_revenue · active_subs · new_users`
→ `useCockpitKpis`, `useMetricDetail(metric)` bunları okur.

**Gerçek tablolar/edge:** `useSentryIssues` (crash), `useSystemHealth` (integrations + lastSyncRun),
`useAppVersions`, `useReviews` + `useReviewReply`, `useAlerts` + `useAckAlert` + `alert_rules`,
`useProperties` (status/lastPing), `useUsers` (email/**country**/lastSignIn), `useAudit`, `useSegments`.

**Hiç olmayan (ingestion yok):** IAP/abonelik geliri ayrımı, platform kırılımı (iOS/Android/Web),
MRR hareketi, payouts (Stripe/ASC), tekil ödeme işlemleri, retention/funnel/acquisition,
OS sürüm dağılımı, WAU/MAU, **session-bazlı crash-free %**.

> Varsayım: "olmayan" kalemler mobil hook'larda kaynak göstermediği için backend'de de ingest
> edilmiyor kabul edildi. Tier 3'e geçmeden backend repo'da teyit edilmeli.

---

## Sayfa sayfa durum

### 1 · Overview
| Alan | Durum | Gerçek kaynak |
|---|---|---|
| Hero gelir (bugün ad_revenue) + trend | ✅ GERÇEK | `useMetricDetail('ad_revenue')` |
| DAU, MRR mini-stat (+delta) | ✅ GERÇEK | `useCockpitKpis` |
| Canlı "ACTIVE" (=DAU) | ✅ GERÇEK | kpis.dau |
| Projeler listesi + tip filtresi + status | ✅ GERÇEK | `useProperties` |
| Needs attention (alert + Resolve) | ✅ GERÇEK | `useAlerts`+`useAckAlert` |
| **Crash-free mini-stat** | ⚠️ DEMO | yok (session crash-free) → Tier 3 |
| **Aylık hedef şeridi** | ⚠️ DEMO | hedef saklanmıyor → Tier 2 |
| **Proje satırı KV** (revToday/MRR/crash-free) | ⚠️ DEMO | per-proje `metrics` VAR → Tier 1 |

### 2 · Revenue (en demo-yoğun)
| Alan | Durum | Gerçek kaynak |
|---|---|---|
| Hero toplam + 7/30/90 trend | ⚠️ DEMO seri | `useMetricDetail('ad_revenue'/'mrr')` VAR → Tier 1 |
| MRR stat | ✅ GERÇEK | kpis.mrr |
| ARPU | ⚠️ DEMO | türetilebilir (gelir/total_users) → Tier 1 |
| Conversion | ⚠️ DEMO | funnel yok → Tier 3 |
| Revenue mix (subs/IAP/ads) | ⚠️ DEMO | ad_revenue+mrr gerçek, **IAP yok** → kısmi/Tier 3 |
| Platform kırılımı | ⚠️ DEMO | boyut yok → Tier 3 |
| MRR hareketi | ⚠️ DEMO | abonelik event'i yok → Tier 3 |
| Subs (active/trial/churn) | ⚠️ KISMİ | active_subs gerçek; trial/churn → Tier 3 |
| Payouts + işlemler | ⚠️ DEMO | Stripe/ASC yok → Tier 3 |

### 3 · Analytics (mostly demo)
| Alan | Durum | Gerçek kaynak |
|---|---|---|
| Hero DAU + delta | ✅ GERÇEK | kpis.dau |
| Hero bar grafiği | ⚠️ DEMO seri | `useMetricDetail('dau')` VAR → Tier 1 |
| New users stat | ⚠️ DEMO | new_users metric VAR → Tier 1 |
| **Ülkeler** | ⚠️ DEMO | `useUsers` country aggregation VAR → Tier 1 |
| WAU/MAU | ⚠️ DEMO | metric yok → Tier 3 |
| Stickiness / avg session | ⚠️ DEMO | event yok (PostHog) → Tier 3 |
| Retention / Funnel / Acquisition / OS | ⚠️ DEMO | PostHog/attribution yok → Tier 3 |

### 4 · Health (mostly real)
| Alan | Durum | Gerçek kaynak |
|---|---|---|
| Crashes (ara/filtre/resolve/Sentry) | ✅ GERÇEK | `useSentryIssues` |
| Hero stats (issues/fatal/events) | ✅ GERÇEK | sentry issues |
| Integrations | ✅ GERÇEK | `useSystemHealth` |
| App versions | ✅ GERÇEK | `useAppVersions` |
| Reviews + yanıt | ✅ GERÇEK | `useReviews`+`useReviewReply` |
| Heartbeat status/lastPing | ✅ GERÇEK | `useProperties` |
| **Crash-free % + trend** | ⚠️ DEMO | Sentry sessions yok → Tier 3 |
| Heartbeat bar (per-proje crash-free) | ⚠️ DEMO | yok → Tier 3 |

### 5 · Settings (mostly real)
| Alan | Durum | Gerçek kaynak |
|---|---|---|
| Workspace (proje sayısı) | ✅ GERÇEK | `useProperties` |
| Data sources | ✅ GERÇEK | `useSystemHealth` |
| Currency (kalıcı) | ✅ GERÇEK | `preferences` |
| Sign out | ✅ GERÇEK | `supabase.auth` |
| **Alert rules "3 active"** | ⚠️ HARDCODED | `alert_rules` count VAR → Tier 1 |
| **Last sync "2m ago"** | ⚠️ DEMO | `systemHealth.lastSyncRun` VAR → Tier 1 |
| Push/Critical/Widget toggle | ⚠️ LOCAL | persist + expo-notifications → Tier 2 |
| Quiet hours / Sync frequency | ⚠️ HARDCODED | pref/backend → Tier 2 |

---

## Plan (öncelikli)

### Tier 1 - şimdi bağlanabilir (kaynak mobilde/metrics'te var, düşük efor)
1. **Analytics hero bar** → `useMetricDetail('dau')` gerçek seri (demoData.dauSeries kalkar).
2. **Analytics ülkeler** → `useUsers`'ı country'ye göre aggregate eden bir hook (gerçek).
3. **Analytics new users** → `useCockpitKpis.newUsers`.
4. **Revenue hero trend** → `useMetricDetail('ad_revenue')`/`'mrr'` gerçek seri + dönem dilimleme.
5. **Revenue ARPU** → türet: `adRevenue / total_users` (veya mrr/active_subs).
6. **Revenue subs.active** → `active_subs` gerçek.
7. **Settings "Alert rules"** → `alert_rules` satır sayısı (yeni küçük hook).
8. **Settings "Last sync"** → `systemHealth.lastSyncRun.finishedAt` (relatif).
9. **Overview proje satırı KV** → per-property `metrics` batched hook (revToday/mrr gerçek).

→ Hepsi mobil-içi; backend değişikliği yok. Çıktı: demo etiketlerinin ~yarısı kalkar.

### Tier 2 - persist + hafif entegrasyon (mobil + ufak backend/pref)
10. **Push/Critical bildirim toggle** → `preferences`'a persist + `expo-notifications` kayıt.
11. **Aylık gelir hedefi** → kullanıcı-set hedef (preference veya küçük tablo).
12. **Widget toggle** → mevcut `useWidgetSync`'e bağla.

### Tier 3 - gerçek backend/entegrasyon ingestion gerektirir (şu an veri yok)
13. **Session crash-free % + trend** (Overview + Health) - Sentry sessions API → yeni metric.
14. **Revenue derinliği** - IAP/abonelik geliri ayrımı, platform kırılımı, MRR hareketi, payouts,
    tekil işlemler - RevenueCat/Stripe/App Store Connect ingestion.
15. **Analytics derinliği** - retention, funnel, acquisition, OS, WAU/MAU - PostHog/attribution ingestion.
16. **Subs detayı** - trial/trial→paid/churn - RevenueCat.

→ Her biri backend'de yeni ingest + metric/edge ister. Önce backend repo'da neyin zaten
ingest edildiği teyit edilmeli (varsayımı doğrula).

---

## Önerilen sıra
**Tier 1'i tek slice'ta bitir** (en görünür kazanım, sıfır backend riski) → demo etiketlerini yarıya
indirir. Sonra Tier 2 (toggle/persist). Tier 3 backend yol haritasına bağlı, ayrı ayrı.
