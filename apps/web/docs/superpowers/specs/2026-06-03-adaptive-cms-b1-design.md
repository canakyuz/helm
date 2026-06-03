# Adaptive CMS — B1 Design (schema-derived-from-data)

> Status: **Approved (karar net)** · Date: 2026-06-03 · Owner: Can
> Scope: helm **web** CMS. Mobil ve Levios kapsam dışı (Levios "lift" notu §10).

## 1. Problem

helm, **8-9 dış sitenin** içeriğini yönetecek ve onlara geri yayınlayacak. Her sitenin içeriği
**farklı nested şekilde** gelen bir JSON sözlüğü — örnek:

```json
{
  "nav": { "links": [{ "href": "/", "label": "Home" }] },
  "search": { "placeholder": "Ara..." },
  "contact": { "email": "x@y.co", "phone": "..." },
  "_meta": { "lang": "tr", "updated": "2026-06-01" }
}
```

CMS, **gelen JSON'un key/value yapısına göre şekil almalı** — yapı veriye göre uyarlanır, önceden
elle tanımlanmaz. Editör bu içeriği düzenler, helm 8-9 siteye publish eder.

## 2. Mevcut durum (kanıt)

helm'de CMS omurgasının ~%70'i hazır:

| Parça | Dosya | Durum |
|---|---|---|
| Schema-as-data tipleri | `src/types/cms.ts` | `FieldDef[]` discriminated union; **recursive** (`list.of: FieldDef`) |
| Runtime Zod + boş entry | `src/lib/cms-schema.ts` | `buildZodSchema()`, `defaultEntryData()` — `list` recursion var |
| Form motoru | `src/components/cms/form-renderer.tsx` | kind→input switch, list/json recursive |
| Şema tasarımcı | `src/components/cms/schema-designer.tsx` | var |
| Publish | `src/lib/cms-publish.ts` | revision snapshot → status=published → Edge Function webhook |
| Asset / locale | `cms-assets.ts`, `locale-switcher.tsx` | var |

**Tek yapısal eksik:** `FieldDef`'te **isimli-key'li `object`/`group` tipi yok.** Nested objeler şu an
ancak opak `kind:"json"` ile temsil edilebiliyor (ham JSON düzenleme → kötü UX + yapı kaybı).

## 3. Karar: B1 + `object` kind (B1.5 değil)

İlk değerlendirmede B1.5 (JSON Schema kanonik kaynak) önerilmişti. **Kodu okuyunca karar değişti:**

- `FieldDef` zaten `list` ile recursive. `object` kind'ı eklenince **FieldDef tam bir ağaç** olur
  (object + list + primitive) → **JSON Schema'nın bir alt kümesiyle yapısal eşdeğer.**
- Bu noktada `FieldDef → JSON Schema` **saf mekanik fonksiyon**; B1.5'in taşınabilirliğini ekstra
  adapter katmanı olmadan, bedavaya verir.
- **Asıl çatal B1 vs B1.5 değil → `object` kind vs `json` escape-hatch.** Nested'i `json` yapmak hem
  şimdiki UX'i hem sonraki Levios taşımasını öldürür; `object` yapmak ikisini de kurtarır.
- **YAGNI:** JSON Schema'yı bugün kanonik kaynak yapmak (B1.5 adapter), belirsiz bir Levios geleceği
  için erken soyutlama. `object` kind yeterli sigorta.

**Karar:** `FieldDef`'e `object` kind ekle, nested'i asla `json`'a dökme. JSON Schema'yı kanonik
kaynak yapma (henüz). Ham JSON örneğini sakla (geri-türetme sigortası, §7).

## 4. Mimari: schema-derived-from-data

```
1. INGEST     site JSON'u al (manuel paste / API / dosya)
2. INFER      JSON örnek(ler)inden FieldDef ağacı çıkar (§6)
3. REVIEW     insan onayı — schema-designer'da çıkarılan ağacı düzelt/onayla
4. PERSIST    cms_collections.schema = FieldDef[]  +  ham örneği sakla
5. EDIT       form-renderer ile düzenle, buildZodSchema ile doğrula
6. PUBLISH    cms-publish.ts (mevcut) → siteye webhook
```

İnsan onayı (3) kritik: çıkarım hatalı tahmin edebilir (string mi slug mı, vs). AI/heuristic
**sadece taslak** üretir; kanonik şemayı insan onaylar.

## 5. Tip değişikliği — `object` kind

`src/types/cms.ts`:

```ts
export type FieldDef =
  | ... (mevcutlar)
  | (FieldBase & { kind: "object"; fields: FieldDef[] })   // YENİ
```

Switch'ler exhaustive (`fieldToZod`'da `schema` initialize-before-use) → TS, `object`'i her yerde
ele almaya zorlar. Eklenecek yerler:

- `cms-schema.ts` `fieldToZod`: `case "object": z.object(fields → shape)` (satır 54-59 deseni)
- `cms-schema.ts` `fieldDefault`: `case "object": { ...fields map default }`
- `form-renderer.tsx`: `object` branch — `list` recursion desenini kopyala, fieldset gibi render
- `schema-designer.tsx`: `object` için alt-alan ekle/düzenle UI

## 6. Şema çıkarımı (INFER) — algoritma

`inferSchema(samples: unknown[]): FieldDef[]`

Bir değer için tip kuralı:
- `string` → `text` (uzunsa `textarea`; ISO tarih ise `date`; tek-kelime-kebab ise `slug` — heuristik)
- `number` → `number`
- `boolean` → `boolean`
- `array` → `list`, `of` = elemanların şemalarının **birleşimi** (objeler ise key'leri merge)
- `object` → `object`, `fields` = her key için recursive çıkarım
- `null` → nullable, tip bilinmiyorsa fallback `text`

**Çok-örnek birleştirme:** `required` = key **tüm** örneklerde varsa; yoksa `optional`.

**Rezerve key'ler:** `_meta` editlenebilir içerik değil — sistem metadata'sı (§8). Çıkarımda field
olarak üretilmez; `_meta.lang → entry.locale`, `_meta.updated → updated_at` map edilir.

**Karmaşıklık:** Time **O(N·K)** (N = örnek sayısı, K = ağaçtaki toplam düğüm) — girdi boyutunda
lineer. Space **O(K)** (şema ağacı). Nesting derinliği **D ≤ 3** sınırı (UX + recursion guard).

## 7. Veri modeli

- `cms_collections.schema` (mevcut jsonb) → `object` içeren FieldDef[] tutar. **Şema değişikliği yok.**
- `cms_entries.data` (mevcut jsonb) → nested obje barındırır. **Şema değişikliği yok.**
- **Ucuz sigorta (yeni):** ingest edilen **ham JSON örneğini** sakla — `cms_collections`'a
  `source_sample jsonb null` kolonu (migration). Levios/yeniden-türetme gerekince FieldDef'ten
  geri-mühendislik yapmazsın; ham örnekten yeniden türetirsin.

## 8. i18n / `_meta`

- helm `cms_entries.locale` ile **satır-bazlı** i18n yapıyor (mevcut). Gelen `_meta.lang` →
  entry'nin `locale`'ine map edilir; her dil = ayrı entry satırı.
- `_meta` content değil → form'da gösterilmez; publish'te tekrar enjekte edilir (lang/updated).

## 9. Publish

Değişiklik yok. `cms-publish.ts` mevcut akış: revision snapshot → status=published → Edge Function
webhook (`CmsPublishTarget` {name,url,secret,locales?}). Nested data publish payload'ında olduğu
gibi gider. (Not: publish retry/state-machine zayıf — ayrı iş, bu spec dışı.)

## 10. Levios-later (neden B1 kilit değil)

`object` kind eklenince FieldDef ağacı = JSON Schema alt kümesi. Levios JSON-Schema-tabanlı bir
content modeline geçtiğinde:
```
FieldDef(object/list/primitive) → JSON Schema   // pure, mekanik fonksiyon
+ source_sample (§7)                              // gerekirse yeniden türet
```
Taşıma **"lift"**, rewrite değil. Bugün B1.5 adapter katmanına gerek yok.

## 11. Riskler / açık sorular

- **Recursion derinliği:** 3+ seviye nesting'de form-renderer/schema-designer UX karmaşıklaşır →
  `D ≤ 3` sınırı. Senin örneğin 2 seviye, yönetilebilir.
- **Heuristik yanlış tahmin** (string→slug/date): INSAN ONAYI (§4 adım 3) bunu yakalar; çıkarım
  sadece taslak.
- **Union/oneOf:** FieldDef union tip ifade edemez (JSON Schema edebilir). Site config'lerinde nadir;
  gerekirse o alan `json` fallback (bilinçli, istisna).
- **Array of mixed types:** `list.of` tek tip. Karışık array → en geniş ortak şema veya `json`.

## 12. İş listesi (faz faz, küçük commit)

1. `FieldDef`'e `object` kind + `cms-schema.ts` (Zod + default) — TS zorlar, küçük diff
2. `form-renderer.tsx` `object` recursive render (list desenini kopyala)
3. `schema-designer.tsx` `object` alt-alan UI + `D ≤ 3` guard
4. `inferSchema()` — yeni `src/lib/cms-infer.ts` (§6 algoritma) + karmaşıklık yorumu
5. Migration: `cms_collections.source_sample jsonb null`
6. Ingest UI: JSON paste → infer → schema-designer'da review → kaydet
7. Uçtan uca test: örnek JSON ile bir koleksiyon kur, entry düzenle, publish

Her madde ayrı commit + gözle doğrulama (mobil tasarım turundan ders: kör toplu değişiklik yok).

## 13. Kapsam dışı (non-goals)

- JSON Schema'yı kanonik kaynak yapmak (B1.5) — Levios gerçekleşince
- Publish retry/state-machine güçlendirme — ayrı iş
- Mobil CMS — yok
- AI ile içerik üretimi — çıkarım sadece şema taslağı, içerik değil
