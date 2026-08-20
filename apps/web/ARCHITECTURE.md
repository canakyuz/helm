# helm - Mimari ve Mühendislik Rehberi

> Bu belge helm'in **nasıl düşünüldüğünü** anlatır: katmanlar, desenler,
> ilkeler ve "yeni bir şey eklerken nereye, nasıl" kuralları. Her ekleme
> bu rehbere uymalı; uymuyorsa ya kod ya rehber düzeltilir.

---

## 1. Amaç ve Kapsam

helm, çok-ürünlü bir founder'ın **tüm projelerinin gelir + kullanıcı
metriklerini tek panelde** topladığı bir iç araçtır (founder cockpit).

- **Sahiplik:** Açık kaynak (Refine) üzerine kurulu, tamamen sahip olunan kod.
- **Kapsam:** Salt-okunur metrik toplama + görselleştirme. Müdahale (CRM
  aksiyonları), form, mail gelecekteki fazlar.
- **Kullanıcı:** Tek kişi (founder). Multi-tenant değil - bilinçli.

---

## 2. Mimari İlkeler

helm'in her kararı şu ilkelere dayanır:

| İlke | helm'de karşılığı |
|------|-------------------|
| **Separation of concerns** | Sunum / mantık / veri erişimi ayrı katmanlar |
| **Open/Closed** | Yeni connector veya tema eklemek mevcut kodu değiştirmez |
| **Single source of truth** | `metrics` tablosu, `theme/presets.ts`, `types/` |
| **Idempotency** | Ingestion tekrar çalışsa veri bozulmaz (upsert) |
| **Fail-soft** | Bir connector patlarsa diğerleri etkilenmez |
| **Headless first** | İş mantığı (Refine core) görünümden (shadcn) bağımsız |
| **Convention over configuration** | Dosya yeri = sorumluluk; tahmin edilebilir |
| **KISS / YAGNI** | En basit çalışan optimal çözüm; bugün gerekmeyen esneklik yok |
| **DRY (≥3 tekrar)** | Ortak mantık `lib/`, ortak UI paylaşılan bileşen |

---

## 3. Sistem Mimarisi

helm üç parçadan oluşur: **panel** (SPA), **hub** (Supabase) ve
**ingestion** (Edge Functions).

```
 DIŞ SAĞLAYICILAR          INGESTION (Deno Edge Fn)        HUB (Supabase)         PANEL (Refine SPA)
 ────────────────          ────────────────────────        ──────────────         ──────────────────
 RevenueCat API  ─┐
 AdMob API       ─┤─►  helm-ingest ──┬─ connector dispatch ─► metrics          ─►  Cockpit
 PostHog API     ─┤    (pg_cron 03:00 │  (idempotent upsert)   sync_runs            Projeler
 Proje Supabase  ─┘     + panel manuel)│                       projects             Kullanıcılar
                                       └─ project bazlı filtre  project_integrations
 Proje Supabase  ──►  helm-users ───────────────────────────►  (canlı sorgu)    ─►  Kullanıcılar ekranı
```

**Neden bu şekil:**
- **Hub ayrı bir Supabase projesi** - hiçbir ürünün DB'sine karışmaz; bir ürün
  kapansa bile helm yaşar. Bağımsız yaşam döngüsü.
- **Ingestion sunucu tarafında** - sağlayıcı `service_role` / secret'ları
  tarayıcıya inmez (helm-users örneği). Edge Function = güven sınırı.
- **Panel tamamen istemci** (SPA) - statik barındırılabilir, sunucu durumu yok.

---

## 4. Teknoloji Seçimleri ve Gerekçeleri

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| Dil | TypeScript (strict) | Derleme-zamanı güvenlik; `any` yasak |
| UI framework | React 19 | Mevcut standart, Refine uyumu |
| Build | Vite 6 | Hızlı HMR, native ESM, Tailwind v4 plugin'i |
| Admin framework | Refine v5 (**headless core**) | CRUD/auth/routing soyutlaması; UI'a bağlı değil |
| UI kütüphanesi | shadcn/ui (Radix + Tailwind) | Kopyalanan bileşen - sahiplik; modern, erişilebilir |
| Stil | Tailwind CSS v4 | CSS-first config, `@tailwindcss/vite`; design-token uyumu |
| Grafik | recharts | Hafif, React-yerel; lazy-load edilir |
| Routing | react-router 7 | Refine react-router adapter |
| Backend | Supabase | Postgres + Auth + Edge Functions + cron - tek platform |
| Edge runtime | Deno (Supabase Functions) | Connector'lar; izole, sunucusuz |
| Zamanlama | pg_cron + pg_net | DB-yerel cron; ek altyapı yok |
| Form | react-hook-form + zod | Tip-güvenli doğrulama, şema tek kaynak |

**Headless ayrımı (kritik):** Refine `@refinedev/core` veri/auth/routing
mantığını verir; **görünümü vermez**. Görünüm tamamen shadcn. Bu yüzden
Ant Design → shadcn geçişi mantığa dokunmadan yapılabildi. UI kütüphanesi
değiştirilebilir bir detaydır; mantık değildir.

---

## 5. Katmanlı Mimari

### Panel (frontend)

```
Sunum katmanı      pages/ , components/      React + shadcn. İş mantığı YOK.
   │                                         Veriyi hook'larla ister, gösterir.
   ▼
Veri erişim        providers/ + Refine       useList/useShow/useForm/useCreate...
   │               hook'ları                 Supabase'i soyutlar. SQL bilmez.
   ▼
Domain/mantık      lib/                      Saf fonksiyonlar (series, deltaPct).
                                             Framework-bağımsız, test edilebilir.

Çapraz kesen:      theme/  (tema)   types/  (sözleşmeler)
```

**Kural:** Sunum katmanı `lib/`'i çağırabilir, `providers/`'ı hook ile
tüketir. `lib/` hiçbir şeye bağlı değildir (saf). `providers/` UI bilmez.

### Ingestion (backend)

```
Orchestrator       helm-ingest/index.ts      Akışı yönetir: entegrasyonları
   │                                         gezer, sonuçları toplar, kaydeder.
   ▼
Connector katmanı  connectors/*.ts           Her sağlayıcı bir adapter.
                                             Ortak Connector arayüzü.
Paylaşılan:        _shared/                  CORS, ortak tipler.
```

---

## 6. Dizin Yapısı

```
helm/
├─ src/
│  ├─ App.tsx                 Kök: Refine kurulumu, resources, routing, lazy-load
│  ├─ index.tsx               Giriş noktası, CSS importu
│  ├─ components/
│  │  ├─ ui/                  shadcn primitive'leri - ELLE YAZILMAZ (npx shadcn add)
│  │  ├─ layout/              Uygulama kabuğu: sidebar + header
│  │  ├─ stat-card/           Paylaşılan: istatistik kartı
│  │  ├─ trend-chart/         Paylaşılan: zaman serisi grafiği (recharts)
│  │  ├─ range-select/        Paylaşılan: 7/30/90 gün seçici
│  │  ├─ integrations-panel/  projects'e özel: entegrasyon yönetimi
│  │  └─ error/               404 ekranı
│  ├─ pages/                  Ekranlar - her biri bir route
│  │  ├─ dashboard/           Cockpit
│  │  ├─ projects/            list / create / edit / show + schema.ts
│  │  ├─ users/               Kullanıcılar (CRM)
│  │  └─ login.tsx
│  ├─ lib/                    Saf mantık: metrics.ts (series/latest/deltaPct), utils.ts
│  ├─ providers/              Refine: auth, data, notification, supabase-client
│  ├─ theme/                  presets.ts (5 tema) + ThemeProvider.tsx
│  ├─ types/                  index.ts - domain tipleri (sözleşmeler)
│  ├─ hooks/                  use-mobile.ts
│  └─ styles/                 index.css (Tailwind + tema token'ları), glass.css
└─ supabase/
   ├─ migrations/             NNNN_ad.sql - sıralı, değişmez
   └─ functions/
      ├─ helm-ingest/         index.ts + connectors/ + _shared/
      └─ helm-users/          index.ts
```

**Neden tip-bazlı (feature-bazlı değil):** helm odaklı bir paneldir, ~25
dosya. Feature-folder (`features/cockpit/...`) bu ölçekte gereksiz dolaylılık
(YAGNI). Tip-bazlı yapı tahmin edilebilir ve yeterli. ~40+ dosyaya ulaşırsa
yeniden değerlendirilir.

---

## 7. Veri Modeli

Hub şeması (4 tablo):

```
projects(id, name, slug, created_at)
project_integrations(id, project_id→, provider, config jsonb, enabled,
                     last_synced_at, last_sync_status, last_sync_error)
metrics(project_id→, date, source, metric, value, ingested_at)
        PRIMARY KEY (project_id, date, source, metric)
sync_runs(id, started_at, finished_at, trigger, ingested, ok/error_count, details)
```

### Kilit karar: `metrics` long-format (EAV)

Metrikler **geniş tablo** (her metrik bir kolon) değil, **uzun format**
(her satır bir `(metrik, değer)` çifti) tutulur.

- ✅ **Yeni metrik = sıfır migration.** Connector `{metric:"yeni"}` emit eder,
  tablo değişmez. `ad_impressions`, `wau`, `ecpm` böyle eklendi.
- ✅ Heterojen projeler: web sitesinde DAU yok, oyunda var - sorun değil.
- ⚖️ Bedel: gösterimde pivot gerekir (`lib/metrics.ts` bunu yapar).

Bu, **Open/Closed ilkesinin veri tabanındaki karşılığıdır.**

### Idempotency

`metrics` birincil anahtarı `(project_id, date, source, metric)`. Ingestion
`upsert(onConflict)` kullanır → cron aynı günü tekrar çekse de veri
**çoğalmaz, üzerine yazılır.** Geç gelen veri (dünün AdMob'u) ertesi gün
düzelir. Bu yüzden connector'lar son 90 günü yeniden çeker.

---

## 8. Çekirdek Desenler

### 8.1 Connector deseni (Adapter / Strategy)

Her veri kaynağı ortak bir arayüz uygular:

```ts
type Connector = (config: ConnectorConfig) => Promise<MetricPoint[]>;
```

Orchestrator bir `CONNECTORS` map'inden dispatch eder:

```ts
const CONNECTORS = { revenuecat, admob, posthog, supabase };
const points = await CONNECTORS[integration.provider](integration.config);
```

→ **Yeni sağlayıcı eklemek orchestrator'ı değiştirmez** (Open/Closed). Yeni
adapter yaz, map'e ekle. Her connector hata izolasyonludur: biri patlarsa
`try/catch` yakalar, `last_sync_error`'a yazar, diğerleri devam eder
(fail-soft).

### 8.2 Tema sistemi (design tokens)

Tema = bir CSS custom-property kümesi. `styles/index.css` her tema için bir
`[data-helm-theme="..."]` bloğu tanımlar; `ThemeProvider` aktif temayı
`<html>`'e yazar. Bileşenler token okur (`bg-card`, `text-foreground`),
sabit renk kullanmaz.

→ **Yeni tema = `presets.ts`'e bir girdi + `index.css`'e bir blok.** Bileşen
kodu değişmez. Tema, görünümün değiştirilebilir bir parametresidir.

### 8.3 Provider deseni (Refine)

`providers/` Refine'a "veri nereden gelir / kim giriş yapar / bildirim nasıl"
sorularını cevaplar. Bileşenler `useList`/`useForm` gibi hook'larla bu
katmanı tüketir - doğrudan `supabaseClient` çağırmaz (istisna:
`functions.invoke`, çünkü Refine edge function soyutlamaz).

### 8.4 Kod bölme (code splitting)

Sayfalar `React.lazy` ile route bazlı yüklenir. recharts ağır (~350 KB) -
yalnızca grafikli sayfa açılınca yüklenir. İlk açılış hafif.

---

## 9. Mühendislik İlkeleri (helm'e uygulanmış)

- **DRY:** `lib/metrics.ts` ortak (Cockpit + proje detayı + Kullanıcılar);
  `StatCard`/`TrendChart`/`RangeSelect` paylaşılan; connector arayüzü tek.
  Kural: 3. tekrardan sonra soyutla - erken değil.
- **KISS:** Tek hub DB, tip-bazlı klasör, manuel-değil-otomatik. Gereksiz
  soyutlama yok.
- **YAGNI:** Vault şifreleme ertelendi (lokal - gerek yok); form/mail Tally/
  Loops'a bırakıldı (yeniden icat etme); feature-folder yok.
- **Tip güvenliği:** `strict: true`, `any` yasak; `Connector`/`Metric`/
  `HelmTheme` tiplenmiş; form doğrulaması `zod` şemasıyla tek kaynaktan.
- **Saf fonksiyonlar:** `lib/metrics.ts` yan etkisiz, deterministik -
  kolay test edilir, kolay akıl yürütülür.
- **Erken çıkış:** Connector ve orchestrator guard clause kullanır.
- **Hata yönetimi:** Fail-soft ingestion; her entegrasyon izole; hata
  `last_sync_error` + `sync_runs.details`'e yazılır (yutulmaz).
- **Karmaşıklık farkındalığı:** `latestByProject` O(n); `series` O(n log n)
  (sıralama). Connector'larda gereksiz iç içe döngü yok.
- **Observability:** `sync_runs` her çalışmayı kaydeder; panel gösterir.

---

## 10. Konvansiyon - Nereye Ne Eklenir

| Eklenen | Yer | Nasıl |
|---------|-----|-------|
| Yeni ekran | `pages/<ad>/index.tsx` | + `App.tsx` resources girdisi + `<Route>` (lazy) → sidebar otomatik |
| Paylaşılan bileşen | `components/<ad>/index.tsx` | ≥2 ekran kullanıyorsa |
| Ekrana özel bileşen | ilgili `components/` veya page klasörü | tek ekran kullanıyorsa |
| shadcn primitive | `components/ui/` | `npx shadcn add <ad>` - elle yazma |
| Yeni metrik | connector `{metric:"ad"}` emit eder | **migration YOK** (long-format) - sadece UI'da göster |
| Yeni veri kaynağı | `functions/helm-ingest/connectors/<ad>.ts` | `Connector` uygula + `CONNECTORS` map + `types.ts` provider + entegrasyon formu alanları |
| Yeni edge function | `functions/<ad>/index.ts` | ayrı klasör; CORS + service_role deseni |
| Yeni DB tablosu/alanı | `migrations/NNNN_<ad>.sql` | sıralı numara; **eski migration'a asla dokunma**; RLS ekle |
| Yeni tema | `theme/presets.ts` girdisi + `styles/index.css` bloğu | iki yer, başka yok |
| Saf yardımcı | `lib/<ad>.ts` | framework'süz, yan etkisiz |
| Domain tipi | `types/index.ts` | tek sözleşme dosyası |
| Refine ayarı (provider) | `providers/<ad>.ts` | data/auth/notification deseni |

---

## 11. Reçeteler - Adım Adım

### Yeni ekran eklemek
1. `pages/<ad>/index.tsx` - bileşeni yaz (`export const <Ad>Page`).
2. `App.tsx` - `lazy()` importu ekle.
3. `App.tsx` `resources` dizisine `{ name, list, meta:{label, icon} }` ekle.
4. `App.tsx` `<Routes>` içine `<Route>` ekle.
→ Sidebar `useMenu()` ile maddeyi otomatik üretir.

### Yeni veri kaynağı (connector) eklemek
1. `connectors/<ad>.ts` - `Connector` arayüzünü uygula, `MetricPoint[]` döndür.
2. `helm-ingest/index.ts` `CONNECTORS` map'ine ekle.
3. `types.ts` (panel) `ProviderName`'e ekle + config tipi.
4. `integrations-panel` `PROVIDER_FIELDS`'e form alanlarını ekle.
5. `migrations` - `project_integrations.provider` CHECK kısıtını genişlet.
6. `supabase functions deploy helm-ingest`.

### Yeni metrik eklemek
1. İlgili connector'da `points.push({ date, metric:"yeni", value })`.
2. Panelde `latest(metrics,"yeni")` / `series(...)` ile oku, kart/grafik ekle.
→ Migration gerekmez.

### Yeni edge function eklemek
1. `functions/<ad>/index.ts` - `Deno.serve`, CORS preflight, gerekiyorsa
   `service_role` ile hub client.
2. `supabase functions deploy <ad>`.
3. Panel `supabaseClient.functions.invoke("<ad>", { body })` ile çağırır.

---

## 12. Güvenlik Modeli

- **RLS:** Tüm hub tablolarında açık. Tek-kullanıcılı iç araç →
  `authenticated` tam erişim; `sync_runs` salt-okunur. Edge Function
  `service_role` ile RLS'i bypass eder.
- **Güven sınırı:** Sağlayıcı `service_role` key'leri (helm-users) **Edge
  Function içinde** kullanılır, tarayıcıya inmez.
- **Bilinen borç:** Sağlayıcı API anahtarları v1'de `project_integrations.
  config` jsonb'de plaintext. Lokal + tek kullanıcı olduğu için kabul edilir;
  **internete deploy edilmeden önce Supabase Vault'a taşınmalı** (BACKLOG P1).
- **Kayıt kapalı:** Panel kullanıcısı Supabase dashboard'tan elle eklenir.

---

## 13. Gözlemlenebilirlik

- `sync_runs` - her ingestion çalışması: zaman, tetikleyici (manuel/cron),
  metrik sayısı, ok/hata sayısı, `details` jsonb.
- `project_integrations.last_sync_status` / `last_sync_error` - connector
  bazlı son durum; panelde tooltip ile gösterilir.
- Cockpit "Son Senkronlar" kartı bu veriyi okur.
- Eksik: panel kendi JS hatalarını izlemiyor (BACKLOG P5 - Sentry).

---

## 14. Build, Çalıştırma, Deploy

- **Geliştirme:** `npm run dev` (Refine dev → Vite). `.env.local` gerekir.
- **Build:** `npm run build` (`tsc` + Vite). Strict TS geçmeli.
- **Migration:** `supabase db push` - sıralı, geri-uyumlu.
- **Edge Function:** `supabase functions deploy <ad>`.
- **Cron:** `pg_cron` job kayıtlı; Vault secret'ları girilince aktif.
- **Barındırma:** Şu an lokal. Deploy hedefi Vercel (statik SPA). Deploy =
  Güvenlik Modeli'ndeki Vault borcu kapatılmalı.

---

## 15. Kod Stili ve İsimlendirme

- Bileşen dosyaları: `kebab-case/` klasör + `index.tsx`; bileşen `PascalCase`.
- Hook'lar: `useXyz`. Saf yardımcılar: `camelCase`, fiil-isim.
- Migration: `NNNN_kebab_ad.sql`, sıralı, **asla geriye dönük düzenlenmez**.
- Connector dosyası = sağlayıcı adı; `fetch<Provider>` export eder.
- Yorum NEDEN'i açıklar, NE'yi değil. Türkçe yorum (proje dili).
- Fonksiyon < ~20 satır, tek sorumluluk; nesting < 3; guard clause tercih.
- `any` yasak - `unknown` + daraltma.

---

## 16. YAGNI Sınırları - Bilinçli Yapılmayanlar

Aşağıdakiler **kasıtlı olarak yok**; ihtiyaç kanıtlanınca eklenir:

- Feature-folder yapısı (ölçek küçük).
- Vault şifreleme (lokal - deploy'da gelecek).
- Form/mail motoru (Tally/Loops kullanılacak - yeniden icat yok).
- Çoklu kullanıcı / rol sistemi (tek founder).
- Manuel metrik girişi (otomasyon ilkesine ters).
- Test paketi (kritik saf mantık `lib/` ileride; UI testi obsesyonu yok).
- State yönetimi kütüphanesi (Refine + React Query yeterli).

> Bu sınırlar tartışmaya açıktır - ama varsayılan "ekleme"dir, "ekle" değil.
