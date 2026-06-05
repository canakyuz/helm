# CMS Tipli İçerik Paneli — Tasarım Spec'i

**Tarih:** 2026-06-05
**Durum:** Onaylandı (brainstorming → implementasyon)
**Kapsam:** helm web (`apps/web`) + ingest script
**Önceki spec:** `2026-06-05-key-value-editor-design.md` — **SUPERSEDED** (schema-less yön terk edildi, KVE kaldırılıyor).

## Problem & yön düzeltmesi

DB'den gelen en.json (2000+ satır) gerçek bir içerik paneli gibi düzenlenmeli — ham JSON
ya da generic key-value tree değil. Schema-less yaklaşım (KVE) "gerçek CMS paneli" hissi
vermedi. Doğru model: **en.json'dan BİR KERE tipli şema üret, dondur, tipli panelde düzenle.**

## Governance — drift'i öldüren kural (revert'ten farkı bu)

Inference + object kind + ingest daha önce revert edilmişti çünkü **sürekli/otomatik** idi →
schema data'dan canlı türeyip drift ediyordu. Bu sefer:

- Inference **yalnızca ingest script'te** çalışır (dev-tetikli, build/dev zamanı).
- Runtime'da **hiçbir yerde** `inferSchema` çağrılmaz; editör şemayı **okur**, sadece `data` yazar.
- Güncelleme = ingest'i **tekrar çalıştır** → `mergeSchema` non-destructive (yeni alan ekler,
  dev'in tweak'lerini korur, silineni raporlar).
- İki yol fiziksel ayrı → drift imkânsız.

## Veri akışı

```
[kaynak en.json] ──bun run ingest──▶ inferSchema ─▶ mergeSchema(mevcut) ─▶ cms_collections.schema (DONMUŞ)
                                                                            cms_entries.data = en.json (unwrap)
                          RUNTIME (re-infer YOK):
   useOne(schema)+useOne(entry) ─▶ SectionedForm(schema,data) ─▶ onChange(data) ─▶ useUpdate ─▶ publish
```

**Unwrap:** ingest, bundle key'lerini schema top-level'a lift eder; `entry.data = en.json`
(artık `{bundle:{…}}` sarmalı yok). Yayınlanan payload **birebir en.json shape**. `_meta`
data'da kalır (pass-through) ama şemaya **girmez** (sistem metadata'sı, düzenlenmez).
→ Tüketici (Friday) `data.bundle` değil `data` okur. **ONAYLANDI.**

## Slice 1 — `object` kind + KVE temizliği

- `types/cms.ts`: `| (FieldBase & { kind: "object"; fields: FieldDef[] })`.
- `lib/cms-schema.ts`: `fieldToZod` object → `z.object(shape)`; `fieldDefault` object → nested default.
- `form-renderer.tsx`: object → nested grup (recursive `FieldRow`). **KVE import + json wiring geri alınır**, json kind → eski textarea fallback.
- `components/key-value-editor/` **silinir**; eski KVE spec'i silinir.

## Slice 2 — inference + merge + ingest

- `lib/cms-infer.ts`: revert'ten **restore** (zaten object/list/primitive, D≤3 guard, humanize,
  `_meta` hariç, O(N·K)). Select/asset infer edilmez (tek örnekten bilinemez) → text; dev
  SchemaDesigner'da bir kere promote eder, merge korur.
- `lib/cms-merge.ts` (yeni): `mergeSchema(existing, inferred)` → `{ fields, added, removed, conflicts }`.
  Ada göre eşle: var olan korunur (kind/label/select tweak), yeni eklenir, object/list içine recurse,
  silinen otomatik silinmez (raporlanır), kind çakışması raporlanır.
- `scripts/cms-ingest.ts` (yeni, generic): `seed-friday` plumbing pattern (service-role client,
  ensure brand/property/collection). en.json oku → inferSchema → mergeSchema(mevcut) → collection.schema
  güncelle → entry upsert (`data = en.json`, unwrap). `package.json`: `ingest:friday`, `ingest:wesan`.

## Slice 3 — iki-pane UI (`SectionedForm`)

Master-detail. Kabuk (header, Taslak/Yayınla, EN/TR, Geçmiş/Diller) aynı; ana alan:

```
İçerik · en · Site bundle              [Taslak] [Yayınla]
 Common      │  COMMON
 Nav       ● │   Brand     [ Wesan                    ]
 Footer      │   Tagline   [ We build calm software… ]
 Pages       │   …
 Collections │
 (sol: bölüm listesi, aktif=lime)   (sağ: tek bölüm alanları)
```

- **Bölümler** = top-level object/list alanları; top-level leaf alanlar varsa ilk "Genel" bölümünde.
- Sol ray: sade liste, aktif = lime nokta/vurgu. Sağ: **sadece seçili bölüm** → `FormRenderer`
  ile `data[section]` slice'ı (`onChange → {...data,[section]:next}`).
- Nested obje → bölüm içinde collapsible grup (FormRenderer object render). List → ↑↓✕ + ekle.
- Alan stili: label üstte, sakin boşluk, lime focus (mevcut ui primitives). **Arama yok** (sade).
- Diğer ekranlar (Şemalar/İçerikler/Medya) dokunulmaz.

## Slice 4 — doğrulama

`bun run ingest:wesan` → şema üret → `bun run dev` → edit sayfasında iki-pane tipli panel **gözle doğrula**.

## Test (kritik mantık)

`cms-infer` (kind seçimi, _meta hariç, required, D≤3 json fallback) + `cms-merge`
(add/keep/removed/conflict, nested recurse) → `bun test`.

## Karmaşıklık

inferSchema O(N·K) tek geçiş; mergeSchema O(M) alan; SectionedForm aktif bölüm render → ekranda
yalnız bir bölümün alanları (büyük bundle'da sabit yük).
