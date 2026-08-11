# Panel Düzeltmeleri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Üç bağımsız panel kusurunu gidermek — gelir çarpanının 3'te kilitli olması, AdMob gelirinin uygulamalara ayrışmaması, ve mobilde yazılmış ama hiçbir ekrana bağlanmamış oyuncu haritası.

**Architecture:** Üç görev birbirinden tamamen bağımsızdır; sırayla ya da ayrı ayrı gönderilebilir. İkisi mobil kabuğa (`apps/mobile`), biri ingest konnektörüne (`supabase/functions/helm-ingest/connectors/admob.ts`) dokunur. Hiçbiri veritabanı migration'ı gerektirmez.

**Tech Stack:** Expo (SDK 56) + expo-router, TypeScript, TanStack Query, MMKV (preferences), Deno edge functions, AdMob networkReport API.

**Spec:** `docs/superpowers/specs/2026-08-10-panel-duzeltmeleri-design.md`

## Global Constraints

- **Çarpan üst sınırı 100, alt sınır 1.** Alt sınır değişmez — 1'in altı "geliri küçült" demek olur ve ayarın amacı bu değil.
- **Çarpan yalnızca gösterimdir.** Hiçbir kalıcı veriye veya sunucu hesabına yazılmaz. Ayarın alt etiketi `local display only` bunu söyler ve doğrudur.
- **AdMob değişikliği geriye dönük uyumlu olmalı.** `app_id` config'de yoksa davranış bugünküyle birebir aynı kalır: yayıncı hesabındaki tüm uygulamaların toplamı.
- **Yeni migration yok.** `integrations.config` zaten JSON; alan eklemek şema değişikliği gerektirmez.
- **Harita için yeni bileşen veya yeni sorgu yazılmaz.** İkisi de mevcut; iş yalnızca bağlamaktır.
- Commit formatı: `type(scope): WES-000 message` — tek satır, gövde yok, Co-Authored-By yok, `--no-verify` yok.
- Yorumlar Türkçe ve NEDEN'i açıklar.

## Dosya yapısı

| Dosya | Sorumluluk | Görev |
|---|---|---|
| `apps/mobile/src/lib/preferences.ts` | Çarpan sınırı sabiti | 1 |
| `apps/mobile/app/(cockpit)/settings.tsx` | Çarpan giriş metni | 1 |
| `supabase/functions/helm-ingest/connectors/admob.ts` | Rapor boyutu, app filtresi, gün bazında toplama | 2 |
| `apps/mobile/app/(cockpit)/overview.tsx` | Haritanın bağlanacağı ekran | 3 |

---

### Task 1: Gelir çarpanı sınırını 100'e çıkar

**Files:**
- Modify: `apps/mobile/src/lib/preferences.ts:30`
- Modify: `apps/mobile/app/(cockpit)/settings.tsx:141`

**Interfaces:**
- Consumes: yok
- Produces: `normalizeRevenueMultiplier(value: number): number` davranışı değişir — üst sınır 3 yerine 100. İmza aynı kalır.

- [ ] **Step 1: Sabiti güncelle**

`apps/mobile/src/lib/preferences.ts` içinde:

```ts
const MIN_REVENUE_MULTIPLIER = 1;
const MAX_REVENUE_MULTIPLIER = 100;
```

`MIN_REVENUE_MULTIPLIER` değişmez. `normalizeRevenueMultiplier` gövdesine dokunma — clamp ve yuvarlama mantığı doğru, yalnızca sınır değişiyor.

- [ ] **Step 2: Giriş metnini güncelle**

`apps/mobile/app/(cockpit)/settings.tsx` içindeki `promptRevenueMultiplier` fonksiyonunda, `Alert.prompt`'un ikinci argümanı:

```ts
"Enter a value from 1 to 100. This only changes local display values.",
```

Fonksiyonun geri kalanına dokunma. Giriş zaten serbest metin (`plain-text` + `decimal-pad`) — elle değer yazmak baştan beri çalışıyordu, kesen tek şey clamp'ti.

- [ ] **Step 3: Tip kontrolü**

Run: `cd apps/mobile && bun run typecheck`
Beklenen: bu iki dosyayla ilgili yeni hata yok.

- [ ] **Step 4: Elle doğrula**

Uygulamada Settings → Revenue multiplier → `50` yaz → kaydet.
Beklenen: satırda `50.00x` görünür, gelir değerleri 50 katı gösterilir. Ardından `250` dene: `100.00x`'e kırpılmalı (üst sınır çalışıyor). Sonra `1` yaparak geri al.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/preferences.ts apps/mobile/app/\(cockpit\)/settings.tsx
git commit -m "fix(mobile): WES-000 raise revenue multiplier cap from 3x to 100x"
```

---

### Task 2: AdMob gelirini uygulama bazında ayır

**Files:**
- Modify: `supabase/functions/helm-ingest/connectors/admob.ts`

**Interfaces:**
- Consumes: `integrations.config` JSON'u — mevcut alanlar `publisher_id`, `client_id`, `client_secret`, `refresh_token`; bu görevle opsiyonel `app_id` eklenir.
- Produces: `fetchAdMob` aynı `Connector` imzasını korur ve aynı üç metriği (`ad_revenue`, `ad_impressions`, `ad_ecpm`) döndürür. Değişen tek şey hangi satırların sayıldığı.

**Neden dikkatli olunmalı:** `helm-ingest` metrikleri `onConflict: "project_id,date,source,metric"` ile upsert ediyor. `APP` boyutu eklenince aynı tarih için birden fazla satır döner. Bunlar toplanmadan tek tek push edilirse upsert son satırı yazar ve **toplam gelir sessizce tek bir uygulamanınkine düşer** — mevcut entegrasyonlar için sessiz veri kaybı olur. Bu yüzden gün bazında toplama şart.

- [ ] **Step 1: Rapora APP boyutunu ekle**

`fetchAdMob` içindeki `body`:

```ts
  const body = {
    reportSpec: {
      dateRange: { startDate: ymd(start), endDate: ymd(end) },
      // APP boyutu olmadan yayinci hesabindaki TUM uygulamalar tek gunluk
      // rakamda toplanir ve hangi oyunun kazandirdigi gorunmez.
      dimensions: ["DATE", "APP"],
      metrics: ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSION_RPM"],
    },
  };
```

- [ ] **Step 2: Satır döngüsünü filtre + gün bazında toplama yapacak şekilde değiştir**

Mevcut döngüde her satır doğrudan `points`'e üç nokta push ediyor. Bunun yerine önce gün bazında topla, sonra push et. Döngüyü ve `return`'ü şununla değiştir:

```ts
  const appFilter = typeof config.app_id === "string" && config.app_id.length > 0
    ? config.app_id
    : null;

  // Gun bazinda toplama: APP boyutu ile ayni tarih icin birden fazla satir
  // doner. Tek tek push edilirse ingest'in upsert'i (project_id,date,source,
  // metric) son satiri yazar ve toplam tek uygulamaya duser — sessiz veri kaybi.
  const daily = new Map<string, { revenue: number; impressions: number }>();

  for (const item of items) {
    const row = item.row as
      | {
          dimensionValues?: Record<string, { value?: string }>;
          metricValues?: Record<
            string,
            { microsValue?: string; integerValue?: string }
          >;
        }
      | undefined;
    if (!row) continue;

    // app_id tanimliysa yalnizca o uygulamanin satirlari sayilir. Tanimli
    // degilse hepsi toplanir — mevcut entegrasyonlar icin davranis degismez.
    if (appFilter) {
      const appId = row.dimensionValues?.APP?.value;
      if (appId !== appFilter) continue;
    }

    const dateRaw = row.dimensionValues?.DATE?.value; // "YYYYMMDD"
    if (!dateRaw || dateRaw.length !== 8) continue;
    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

    const mv = row.metricValues ?? {};
    // ESTIMATED_EARNINGS, IMPRESSION_RPM → micros; IMPRESSIONS → integer.
    const revenue = Number(mv.ESTIMATED_EARNINGS?.microsValue ?? 0) / 1_000_000;
    const impressions = Number(mv.IMPRESSIONS?.integerValue ?? 0);

    const acc = daily.get(date) ?? { revenue: 0, impressions: 0 };
    acc.revenue += revenue;
    acc.impressions += impressions;
    daily.set(date, acc);
  }

  const points: MetricPoint[] = [];
  for (const [date, acc] of daily) {
    // eCPM toplanamaz — oranlarin ortalamasi yanlis sonuc verir. Toplanmis
    // gelir ve gosterimden yeniden hesaplanir.
    const ecpm = acc.impressions > 0 ? (acc.revenue / acc.impressions) * 1000 : 0;
    points.push({ date, metric: "ad_revenue", value: acc.revenue });
    points.push({ date, metric: "ad_impressions", value: acc.impressions });
    points.push({ date, metric: "ad_ecpm", value: ecpm });
  }
  return points;
```

`const points: MetricPoint[] = [];` satırının döngüden **önceki** eski tanımını sil — yukarıdaki blok onu döngüden sonra yeniden tanımlıyor. İki tanım kalırsa TypeScript hata verir.

`IMPRESSION_RPM` artık okunmuyor: eCPM her durumda toplanmış değerlerden hesaplanıyor. Metrik listesinden çıkarma — AdMob'un döndürdüğü alanları daraltmak ileride başka bir kırılım gerektiğinde tekrar eklemeyi gerektirir ve maliyeti yok.

- [ ] **Step 3: Tip kontrolü**

Run: `cd supabase/functions && deno check helm-ingest/connectors/admob.ts`
Beklenen: hata yok. `deno` kurulu değilse bu adımı atla ve raporunda açıkça belirt — uydurma bir doğrulama yazma.

- [ ] **Step 4: Geriye dönük uyumluluğu gözle doğrula**

Kodu oku ve şunu teyit et: `config.app_id` tanımlı değilken hiçbir satır filtrelenmiyor ve tüm uygulamalar aynı güne toplanıyor. Bu, değişiklikten önceki davranışla aynı toplamı üretir.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/helm-ingest/connectors/admob.ts
git commit -m "fix(ingest): WES-000 split admob revenue per app via APP dimension and app_id filter"
```

---

### Task 3: Oyuncu haritasını cockpit ana ekranına bağla

**Files:**
- Modify: `apps/mobile/app/(cockpit)/overview.tsx`

**Interfaces:**
- Consumes:
  - `AudienceMap` — `apps/mobile/src/components/liquid/audience-map.tsx`, `~/components/liquid`'den export ediliyor. Props: `{ rows: AudienceMapRow[]; height?: number; fill?: boolean; showPill?: boolean }`
  - `AudienceMapRow = { country: string; country_name: string | null; users: number }`
  - `useGeoBreakdown(projectId?: string)` — `~/hooks/use-analytics`, TanStack Query sonucu döner (`data`, `isLoading`, `isError`)
- Produces: yok (yaprak değişiklik)

`overview.tsx` cockpit'in ilk sekmesidir (`_layout.tsx:35`, `NativeTabs.Trigger name="overview"`), yani ana ekran burasıdır.

- [ ] **Step 1: Import'ları ekle**

`overview.tsx`'in mevcut import bloğuna, komşularının yanına:

```ts
import { useGeoBreakdown } from "~/hooks/use-analytics";
import { AudienceMap } from "~/components/liquid";
```

Dosyada zaten `~/components/liquid`'den bir import varsa `AudienceMap`'i ona ekle, ikinci bir import satırı açma.

- [ ] **Step 2: Veriyi çek**

Bileşenin gövdesinde, diğer hook çağrılarının yanında. `projectId` olarak ekranın halihazırda kullandığı seçili proje kimliğini ver — dosyada `usePropertyMetrics` / `useMetricDetail` gibi hook'lara geçirilen değişkenin aynısı:

```ts
const geo = useGeoBreakdown(selectedPropertyId);
```

Değişken adı dosyadakinden farklıysa dosyadakini kullan; yeni bir seçili-proje kaynağı **uydurma**.

- [ ] **Step 3: Haritayı render et**

KPI bloklarının altına, mevcut kart deseniyle uyumlu şekilde:

```tsx
{geo.data && geo.data.length > 0 ? (
  <AudienceMap rows={geo.data} height={220} />
) : null}
```

Boş/hata durumunda hiçbir şey çizilmez. Gerekçe: veri yokken boş bir dünya haritası göstermek "hiç oyuncun yok" gibi okunur ve yanıltır; kart hiç görünmezse ekran sessizce eksik kalır, bu daha dürüsttür. Yükleme sırasında da aynı — ekranın geri kalanı çalışmaya devam eder.

- [ ] **Step 4: Tip kontrolü**

Run: `cd apps/mobile && bun run typecheck`
Beklenen: `overview.tsx` ile ilgili yeni hata yok. `geo.data`'nın tipi `AudienceMapRow[]` ile uyuşmuyorsa DUR ve raporla — sorgunun döndürdüğü şekil bileşenin beklediğinden farklı demektir, bu plan onları uyumlu varsayıyor.

- [ ] **Step 5: Uygulamada doğrula**

Cockpit ana ekranını aç.
Beklenen: coğrafi verisi olan bir proje seçiliyken harita görünür ve ülke işaretleri çizilir; verisi olmayan projede kart hiç görünmez, ekran çökmez.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(cockpit\)/overview.tsx
git commit -m "feat(mobile): WES-000 surface audience map on cockpit overview"
```

---

## Self-review

**Spec kapsamı:** Spec bölüm 1 (çarpan) → Task 1. Bölüm 2 (AdMob) → Task 2. Bölüm 3 (harita) → Task 3. Karşılıksız gereksinim yok.

**Spec'in öngörmediği, planın eklediği şey:** Spec AdMob için yalnızca "APP boyutunu iste ve filtrele" diyordu. Kodu okuyunca ortaya çıktı ki filtre olmayan durumda gün bazında toplama yapılmazsa ingest'in upsert'i toplam geliri sessizce tek uygulamaya düşürür — yani "geriye dönük uyumlu" şartı toplama olmadan sağlanamıyor. Task 2 Step 2 bunu kapsıyor ve gerekçesi kod yorumuna da yazılıyor. eCPM'in oran olduğu için toplanamayacağı da aynı adımda ele alındı.

**Tip tutarlılığı:** `AudienceMapRow` alan adları (`country`, `country_name`, `users`) bileşenin kendi tanımından birebir alındı. `normalizeRevenueMultiplier` imzası değişmiyor. `fetchAdMob` `Connector` imzasını ve üç metrik adını (`ad_revenue`, `ad_impressions`, `ad_ecpm`) koruyor.

**Test:** Üç görevin hiçbirinde otomatik test yok. Gerekçe: Task 1 bir sabit, Task 3 bir bağlama, Task 2 ise canlı AdMob API yanıtına bağlı ve anlamlı bir birim testi ancak API yanıtını mock'lamakla kurulur — mock'un doğruluğu test edilmiş olmaz. Üçü de elle gözlemlenebilir ve adımlarda nasıl gözleneceği yazılı.
