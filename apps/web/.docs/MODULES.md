# Helm - Brand → Property → Module Mimarisi

> Helm = founder cockpit. Kullanıcı (Can) kendi indie projelerini tek yerden yönetir.
> Para kazanma ürünü değil - kişisel atölye. Bu YAGNI'yi gevşetir (billing tier yok, marketplace yok).
>
> **Bu doküman = sözleşme.** Şema ve UI değişiklikleri buradaki modele bağlı olacak. Konsept değiştiğinde önce burayı güncelle, sonra kodu.

---

## 1. Hiyerarşi

```
Brand (üst seviye - şirket/marka)
  └─ Property (alt seviye - platform/ürün, brand_id NOT NULL)
        └─ Module (property üzerinde toggle edilebilir özellik)
```

**Örnekler:**

```
Brand: Dante
  ├─ Property: Dante.com           (type: website)
  ├─ Property: Dante Web App       (type: web_app)
  └─ Property: Dante Mobile        (type: mobile_app)

Brand: Empire Inc
  └─ Property: Empire Mobile       (type: mobile_app)

Brand: Van
  └─ Property: van.com             (type: website)

Brand: Friday
  └─ Property: Friday SaaS         (type: web_app)
```

**Brand zorunlu.** Tek property'li brand olabilir (Van, Empire) - overhead değil, agregat dashboard'un kararlı şeması için gerekli.

---

## 2. Property type enum

| `type` | Açıklama | Örnek |
|---|---|---|
| `website` | Sadece marketing/içerik sitesi | van.com, dante.com |
| `web_app` | SaaS, dashboard, web uygulaması | Friday, Dante Web |
| `mobile_app` | iOS / Android native | Empire Mobile, Dante Mobile |
| `desktop_app` | macOS / Windows / Linux native | Rust ile yazılan masaüstü uygulamaları |
| `game` | Mobil oyun (mobile_app'ten ayrı KPI seti) | (gelecek) |

Yeni tip eklemek = enum migration + preset tablo satırı. UI değişikliği yok (modül listesinden çekilir).

---

## 3. Modül kataloğu (10 modül)

Her modülün **3 yüzü** var: sidebar nav, dashboard KPI seti, ayarlar bölümü.

| `module_key` | Türkçe etiket | Açıklama | Veri kaynağı (provider) |
|---|---|---|---|
| `content` | İçerik (CMS) | Şemalar, içerikler, medya, i18n | helm-native (cms_* tabloları) |
| `users` | Müşteriler | Kullanıcı listesi, segmentler, kohort | supabase, posthog |
| `analytics` | Analitik | Traffic / DAU / retention | posthog, plausible, app_store_connect |
| `subscriptions` | Abonelik | MRR, churn, aktif abone | revenuecat, stripe |
| `ads` | Reklam | Ad revenue, eCPM, fill rate | admob |
| `reviews` | Yorumlar | App Store / Play Store ratings | app_store_connect, rest (Apple RSS) |
| `funnel` | Huni | Adım dönüşüm, drop indicator | posthog |
| `push` | Push | Bildirim segmentleri, kampanya | helm-native (push_tokens + campaigns) |
| `mail` | Mail | Email kampanyaları, transactional | resend |
| `social` | Sosyal medya | Post planlama, scheduler (gelecek) | placeholder - Mixpost/Postiz entegrasyonu sonra |

### 3.1. Modül ↔ provider eşlemesi (`metrics.source` → `module_key`)

DB değişikliği değil, **client-side mapping**:

```ts
// src/lib/modules.ts (yeni)
export const SOURCE_TO_MODULE: Record<string, ModuleKey> = {
  revenuecat:        "subscriptions",
  stripe:            "subscriptions",
  admob:             "ads",
  posthog:           "analytics",
  plausible:         "analytics",
  supabase:          "users",
  app_store_connect: "reviews",
  resend:            "mail",
  sentry:            "analytics",  // hata oranı = analytics altı
  rest:              "analytics",  // genel
};
```

Bu mapping sayesinde **mevcut `metrics` tablosu hiç değişmiyor**, sadece dashboard "modül X kapalıysa şu source'ları gösterme" filtresi uygular.

---

## 4. Property type → default modül seti (preset)

Wizard'da property type seçilince bu liste otomatik gelir. Kullanıcı checkbox'larla ekler/çıkarır.

| modül \ tip | website | web_app | mobile_app | desktop_app | game |
|---|---|---|---|---|---|
| content       | ✅ | ⚪ | - | - | - |
| users         | - | ✅ | ✅ | ✅ | ✅ |
| analytics     | ✅ | ✅ | ✅ | ✅ | ✅ |
| subscriptions | - | ✅ | ✅ | ⚪ | ⚪ |
| ads           | - | ⚪ | ✅ | - | ✅ |
| reviews       | - | - | ✅ | ⚪ | ✅ |
| funnel        | ⚪ | ✅ | ✅ | - | ✅ |
| push          | - | ⚪ | ✅ | - | ✅ |
| mail          | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |
| social        | ⚪ | - | - | - | - |

- `✅` = preset default (otomatik açık)
- `⚪` = opsiyonel (preset'te kapalı ama UI'da seçilebilir)
- `-` = bu type için anlamsız (UI'da gizli)

**Preset kaynağı:** `src/lib/modules.ts` içinde sabit obje. DB'ye yazmıyoruz çünkü preset şema değil; kullanıcının seçtiği `properties.enabled_modules` array'i tek doğru kaynak.

---

## 5. UX akışı

### 5.1. Property oluşturma (wizard)

```
Step 1 - Brand seç (mevcut listeden) veya yeni brand oluştur
Step 2 - Property bilgileri:
  • name (text, required)
  • slug (auto from name, editable)
  • type (radio: website | web_app | mobile_app | desktop_app | game)
Step 3 - Modüller:
  • type seçildiği anda preset modüller otomatik checked gelir
  • Kullanıcı checkbox ile ekler/çıkarır
  • "Sonra entegrasyon ekle" notu (boş modül = sayfa açılır, empty state gösterir)
Step 4 - (opsiyonel) App Store ID + country (mobile_app/game ise göster)
```

### 5.2. Property ayarları (`/properties/edit/:id`)

Mevcut `/projects/edit/:id` sayfası **eski adıyla redirect** + yeni sayfa içeriği:
- Üstte: name, slug, type, brand_id (read-only - brand transfer ayrı flow)
- Ortada: **Modüller** bölümü - her modül için Switch (aç/kapat) + son kullanım tarihi (varsa)
- Altta: `app_store_id`, `app_store_country` (sadece mobile_app/game ise)
- En altta: "Bu property'yi sil" (cascade onay)

### 5.3. Brand sayfası (`/brands/edit/:id`, yeni)

- name, slug
- Bu brand altındaki property'lerin listesi (table)
- "Yeni property ekle" butonu (Step 1'i atlatıp brand pre-fill ile wizard'a yönlendirir)

### 5.4. Scope switcher (sidebar üstü)

```
┌─────────────────────────────────┐
│ [Brand: Dante       ▾]          │  ← 1. select
│ [Property: Mobile   ▾]          │  ← 2. select (brand'e göre filtreli)
└─────────────────────────────────┘
```

**3 mod:**
- **Brand=All** → tüm brand'ler agregat (helm-level dashboard, mevcut "Tüm Projeler" davranışı)
- **Brand=X, Property=All** → o brand'in tüm property'leri agregat (Dante toplam = mobile + web app)
- **Brand=X, Property=Y** → tek property detay (mevcut tek-proje dashboard)

Sidebar'daki **modül listesi** seçili property'nin `enabled_modules`'una göre filtrelenir. Brand=All veya Property=All ise **union** (brand altındaki tüm modüllerin birleşimi) gösterilir.

---

## 6. Sidebar grup haritası (modül-aware)

Mevcut 20 item / 6 grup → modül-aware 4 grup (saved context Quick Win #3 ile uyumlu):

```
Genel
  • Cockpit             (her zaman görünür)

[content modülü açıksa]
İçerik
  • Şemalar             /cms/collections
  • İçerikler           /cms/entries
  • Medya               /cms/assets

[users + reviews modülleri]
CRM
  • Kullanıcılar        /users           (users)
  • Segmentler          /segments        (users)
  • Yorumlar            /reviews         (reviews)
  • Müdahale Geçmişi    /audit           (her zaman)

[subscriptions + ads + analytics + funnel]
Analitik
  • Gelir & Reklam      /revenue         (subscriptions || ads)
  • Büyüme              /growth          (analytics)
  • Huni                /funnel          (funnel)
  • Uyarılar            /alerts          (her zaman)

[mail + push + social]
İletişim
  • Mail                /mail            (mail)
  • Push                /push            (push)
  • Sosyal              /social          (social - coming-soon badge)
  • Kampanya Geçmişi    /campaigns       (mail || push)

DevOps  (her zaman görünür - sistem işleri)
  • Entegrasyonlar      /integrations
  • Senkron & Sağlık    /system
  • Loglar              /logs
  • Sürümler            /versions

Sistem
  • Ayarlar             /settings
```

**Kural:** Grup tüm child'ları gizliyse grup başlığı da gizlenir. DevOps + Sistem her zaman görünür (modül-bağımsız).

---

## 7. Dashboard cockpit davranışı

Mevcut 3-zone Liquid Cells **dokunulmaz** - sadece KPI seti modüle göre filtrelenir:

| KpiCell | Hangi modül gerekir |
|---|---|
| MRR | subscriptions |
| Aktif Abone | subscriptions |
| Ad Revenue | ads |
| DAU/MAU | users + analytics |
| Yeni Kullanıcı | users |

**Modül kapalıysa:** O cell'in yerine "Modülü aç" placeholder (ghost card) - boş bırakma, zone iskeleti bozulmasın.

**Brand=All / Property=All durumu:** Tüm modüllerin union'ı + her KPI brand-level sum. Bu zaten mevcut `scope === "all"` davranışı - sadece "all" değil "brand:X" seviyesi ekleniyor.

---

## 8. Sınırlar (YAGNI)

Yapılmayacak:
- Modül-level RBAC (tek kullanıcı projesi)
- Plan/tier-based modül kilidi (ücretsiz vs.)
- Marketplace / modül store
- Property-level white-label / domain mapping
- Modüller arası dependency engine (örn. "subscriptions açtın ama users kapalı") - sadece UI uyarısı, blocking yok

Bir gün lazım olursa eklenir; bugün eklenirse YAGNI.
