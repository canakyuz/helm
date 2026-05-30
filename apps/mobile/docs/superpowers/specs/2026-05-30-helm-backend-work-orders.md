# helm BACKEND — İş Emirleri (mobile gerçek-veri için)

_2026-05-30 · helm-mobile'da demo kalan kalemlerin backend kaynağı. Her iş emri `/helm`
repo'sunda (ayrı chat) yapılacak. Mobile tarafı bu kontratlara göre HAZIR — backend bitince
mobilde sadece `demoData.X` → yeni hook değişir (her birinin mobil-tarafı notu altta)._

## Bağlam (kanıt: helm repo)
- `public.metrics` generic: `(project_id, date, source, metric, value)` → **yeni metrik = yeni
  `metric` string + onu yazan connector**. Mobil `useMetricDetail(metric)` / `useCockpitKpis`
  bu tabloyu zaten okuyor; yeni anahtar eklenince mobil otomatik okur.
- `public.metrics_country` var (ülke kırılımı) — geo zaten bağlandı.
- Edge invoke: `supabase.functions.invoke("<name>", { body: {...} })`, snake_case I/O,
  service-role server-side, `project_id` ile scope (yoksa "tüm aktif entegrasyon").
- Sentry edge'i SADECE issues çekiyor; **session/crash-free YOK**.
- PostHog edge'leri: events/acquisition/funnel/geo VAR; **retention/stickiness/session YOK**.

---

## İŞ EMRİ 1 — Crash-free sessions (öncelik: yüksek)
**Neden:** Overview hero mini-stat "Crash-free" + Health hero büyük "%99.2" + trend — şu an demo.
Indie founder için en kritik sağlık sinyali.

**Yapılacak:**
- Sentry **Sessions API**'den (`/projects/{org}/{proj}/sessions/` veya `/stats_v2`) günlük
  crash-free **session rate** çek. Sentry entegrasyonu zaten `project_integrations`'ta var.
- `metrics` tablosuna iki yeni anahtar yaz (günlük, son ~30g):
  - `crash_free_sessions` (değer: 0–100, ör. 99.2)
  - (ops.) `crash_free_users`
- Cron'a ekle (mevcut `helm-cron-health` / hourly cron pattern'i).

**Mobilin beklediği kontrat:** `metrics` tablosunda `metric='crash_free_sessions'`,
günlük seri. Mobil `useMetricDetail('crash_free_sessions')` ile okuyacak (today + series).

**Mobil-tarafı (backend bitince, ~10 dk):**
- Health: `demoData.crashFree/crashTrend` → `useMetricDetail('crash_free_sessions')`.
- Overview heroStats "Crash-free" + `useCockpitKpis`'e `crashFree` alanı (kpis edge'in
  `.in("metric",[...])` listesine `crash_free_sessions` eklenince otomatik).
- DemoChip'leri kaldır.

**Kabul:** Health hero gerçek %, trend grafiği gerçek; Overview crash-free DemoChip'siz.

---

## İŞ EMRİ 2 — Revenue derinliği (öncelik: yüksek — ana odak ödemeler)
**Neden:** Revenue ekranının kartı (Mix / Subs / Payouts) tamamen demo. Ana ürün vaadi bu.

**2a · Gelir mix + platform (RevenueCat/AdMob/App Store Connect)**
- Mevcut connector'lar: revenuecat, admob, appstoreconnect zaten provider listesinde.
- `metrics`'e günlük yaz: `iap_revenue`, `subscription_revenue` (ad_revenue zaten var) →
  mix = bu üçü. Platform için `metrics_country` mantığı gibi bir kırılım ya da yeni
  `metrics_platform (project_id,date,metric,platform,value)` tablosu (iOS/Android/Web).
- (ops.) Yeni edge `helm-revenue-breakdown` → `{ project_id }` →
  `{ mix:[{label,value,pct}], platform:[{label,value,pct}], total }`.

**2b · Abonelik detayı + MRR hareketi (RevenueCat)**
- `metrics`'e: `subs_active` (active_subs var), `subs_trial`, `subs_trial_conversion`,
  `subs_churn_rate`. MRR movement için yeni edge `helm-mrr-movement` →
  `{ new, expansion, contraction, churn, net }` (RevenueCat overview/charts API).

**2c · Payouts (Stripe + App Store Connect + Google Play)**
- Yeni connector: Stripe `payouts` API + ASC/Play finansal raporlar.
- Yeni tablo `payouts (project_id, source, amount, currency, status, arrival_date, fees, gross)`.
- Yeni edge `helm-payouts` → `{ project_id }` →
  `{ pending:[{source,amount}], recent:[{source,amount,date,status,gross,fees,net}] }`.

**Mobil-tarafı:** `revenue.tsx` MixView/SubsView/PayoutsView'deki `demoData.*` →
ilgili yeni hook/edge. Hero zaten gerçek.

**Kabul:** Revenue kartında mix/platform/subs/payouts gerçek; DemoChip yalnız gerçekten
türetilemeyen alanlarda.

---

## İŞ EMRİ 3 — Analytics retention + engagement (öncelik: orta — PostHog)
**Neden:** Analytics'te retention, stickiness, avg session, OS demo.

**Yapılacak (PostHog API, entegrasyon zaten var):**
- Yeni edge `helm-retention` → `{ project_id }` → `{ cohorts:[{day:"D1",pct},...] }`
  (PostHog retention insight).
- `metrics`'e: `wau`, `mau` (stickiness = dau/mau türetilir), `avg_session_sec`.
- Yeni edge `helm-os-breakdown` → `{ project_id }` → `{ rows:[{os,version,pct,users}] }`
  (PostHog `$os`/`$os_version` breakdown).

**Mobil-tarafı:** `analytics.tsx` RetentionSection → `helm-retention`; hero stats
stickiness/avgSession → `wau/mau/avg_session_sec`; OsSection → `helm-os-breakdown`.
WAU/MAU Seg'i gerçek (şu an sadece DAU gerçek).

**Kabul:** Retention/OS gerçek; WAU/MAU çalışır; stickiness/session DemoChip'siz.

---

## İŞ EMRİ 4 — Aylık gelir hedefi (öncelik: düşük — küçük)
**Neden:** Overview "MAY TARGET" demo. Kullanıcı-set hedef.
**Yapılacak:** `revenue_goals (project_id null=all, month, target_amount, currency)` tablosu
+ basit GET/UPSERT (PostgREST yeter, edge gerekmez). RLS authenticated.
**Mobil-tarafı:** `demoData.goal` → `revenue_goals` select; Settings'e "Aylık hedef" satırı (set).
**Kabul:** Hedef kullanıcıdan, ilerleme gerçek gelirden (`ad_revenue` ayı toplamı).

---

## Özet öncelik
1. **Crash-free sessions** (İş Emri 1) — en kritik sağlık sinyali, tek metrik + cron.
2. **Revenue derinliği** (İş Emri 2) — ana ürün; en büyük iş (connector'lar).
3. **Analytics retention/OS** (İş Emri 3) — PostHog, orta.
4. **Hedef** (İş Emri 4) — kozmetik, küçük.

Her iş emri bitince bana "İş Emri N bitti" de — mobil-tarafı bağlamayı (demo→hook) o ekranda
dakikalar içinde yaparım; kontratlar bu dokümanda sabit.
