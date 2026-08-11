# Panel Düzeltmeleri — Tasarım

**Tarih:** 2026-08-10
**Durum:** Tasarım onaylandı
**Kapsam:** Üç bağımsız düzeltme — gelir çarpanı sınırı, AdMob app kırılımı, mobil oyuncu haritası

Üçü birbirinden bağımsızdır ve ayrı ayrı gönderilebilir. Ortak tek noktaları hepsinin mobil kabuğu (ve ikisinin veri hattını) ilgilendirmesi.

---

## 1. Gelir çarpanı 3'te kilitli

### Durum

`apps/mobile/src/lib/preferences.ts:30` çarpanı 3 ile sınırlıyor:

```ts
const MAX_REVENUE_MULTIPLIER = 3;
```

Giriş alanı zaten serbest metin (`Alert.prompt`, `decimal-pad`) — yani elle değer yazmak çalışıyor, yalnızca `normalizeRevenueMultiplier` içindeki clamp kesiyor. `apps/mobile/app/(cockpit)/settings.tsx:141` içindeki açıklama metni de "Enter a value from 1 to 3" diyor.

### Değişiklik

Sınır 100'e çıkarılır, açıklama metni buna göre güncellenir.

### Neden risksiz

Çarpan yalnızca iki yerde uygulanıyor ve ikisi de saf gösterim:

- `apps/mobile/src/hooks/use-format-currency.ts:16` — `valueUsd * rate * revenueMultiplier`
- `apps/mobile/src/hooks/use-widget-sync.ts:26` — iOS widget'a gönderilen görüntüleme kuru

Hiçbir kalıcı veriye, hiçbir sunucu hesabına dokunmuyor. Ayarın kendi alt etiketi de bunu söylüyor: `local display only`. Alt sınır 1 olarak kalır — 1'in altı "geliri küçült" demek olurdu ve ayarın amacı bu değil.

---

## 2. AdMob geliri uygulamalara ayrışmıyor

### Durum

`supabase/functions/helm-ingest/connectors/admob.ts:41` raporu yalnızca tarih boyutuyla istiyor:

```ts
dimensions: ["DATE"],
metrics: ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSION_RPM"],
```

AdMob `networkReport` API'si `APP` boyutunu da destekliyor ancak istenmiyor. Sonuç: yayıncı hesabındaki **tüm** uygulamaların geliri tek bir günlük rakamda toplanıyor. Empire Inc'in kendi reklam geliri, diğer oyunlarınkinden ayırt edilemiyor — dolayısıyla hangi oyunun para kazandığı panelde görünmüyor.

### Çözümün dayandığı gerçek

`helm-ingest` her entegrasyonu kendi `project_id`'siyle işliyor ve metrikleri o projeye yazıyor (`index.ts:110`, `upsert` `onConflict: "project_id,date,source,metric"`). Konnektörler yönlendirme yapmıyor; `MetricPoint` içinde proje bilgisi yok.

Bu yüzden **konnektör sözleşmesini değiştirmeye gerek yok**. Her helm projesi kendi AdMob entegrasyonunu taşır; entegrasyonun config'ine hangi AdMob uygulamasına baktığı yazılır.

### Değişiklik

**Config genişler:**

```
{ publisher_id, client_id, client_secret, refresh_token, app_id? }
```

`app_id` AdMob'un uygulama kimliğidir (`ca-app-pub-…~…`). `client_id` / `client_secret` / `refresh_token` / `publisher_id` aynı yayıncı hesabı için projeler arasında aynı kalabilir; ayrışmayı `app_id` sağlar.

**Konnektör:**

- Rapor `dimensions: ["DATE", "APP"]` ile istenir.
- `app_id` config'de tanımlıysa yalnızca o uygulamanın satırları toplanır.
- `app_id` tanımlı değilse davranış bugünküyle aynı kalır: tüm satırlar toplanır. Bu geriye dönük uyumluluk bilinçlidir — mevcut entegrasyonlar bir migration beklemeden çalışmaya devam eder, `app_id` eklendikçe ayrışır.

**Yeni migration yok.** `integrations.config` zaten JSON.

### Bilinen sınır

Bir helm projesi birden fazla AdMob uygulamasına karşılık geliyorsa (örneğin iOS ve Android ayrı app olarak tanımlıysa) tek `app_id` yetmez. Bu durum ortaya çıkarsa `app_id` alanı diziye çevrilir; şimdiden dizi yapmak kullanılmayan esneklik olur.

---

## 3. Oyuncu haritası mobilde yok

### Durum

Harita mobilde **zaten yazılmış ama hiçbir ekrana bağlanmamış**:

- Bileşen: `apps/mobile/src/components/liquid/audience-map.tsx`, `AudienceMap`, `liquid/index.ts:26`'dan export ediliyor.
- Aldığı veri: `AudienceMapRow = { country, country_name, users }[]`
- Veri kaynağı: `apps/mobile/src/hooks/use-analytics.ts:43` → `geoBreakdownQueryOptions` (`packages/queries/src/analytics.ts:49`)

İki parça da mevcut ve uyumlu; aralarındaki bağlantı hiç kurulmamış. Web tarafında karşılığı `apps/web/src/components/users-geo-map.tsx` olarak dashboard'a bağlı (`pages/dashboard/index.tsx:573`).

### Değişiklik

`AudienceMap`, cockpit ana ekranına bağlanır; verisi mevcut geo hook'undan gelir. Web'deki yerleşimle aynı mantık: kitlenin nerede olduğu, KPI'ların yanında.

Bu bir bağlama işidir, yeni bileşen veya yeni sorgu yazılmaz.

### Boş ve hata durumları

Geo verisi olmayan bir proje seçiliyse (henüz ülke kırılımı toplanmamışsa) harita yerine boş durum gösterilir; ekran çökmez ve boş bir dünya haritası da çizilmez. Sorgu hatasında da aynı davranış — panelin geri kalanı çalışmaya devam eder.

---

## Kapsam dışı

- Mağaza funnel'ının helm'de gösterimi. Empire Inc tarafındaki ölçüm ayrı bir spec'te (`empireinc-app/docs/superpowers/specs/2026-08-10-magaza-funnel-design.md`); veri `analytics_daily`'ye yazıldıktan sonra helm'in `supabase` konnektörüne alan eklenerek okunacak. Ayrı tur.
- `helm-funnel` fonksiyonunun PostHog bağımlılığı. Empire Inc PostHog'a yazmıyor, dolayısıyla o hat bu oyun için ölü; başka projeler için duruyor. Bu spec ona dokunmuyor.
- Web tarafında AdMob kırılımının gösterimi. Veri ayrıştıktan sonra ayrıca ele alınmalı.
