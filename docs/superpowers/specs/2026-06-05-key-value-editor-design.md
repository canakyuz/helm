# Key-Value Editor — Tasarım Spec'i

**Tarih:** 2026-06-05
**Durum:** Onaylandı (brainstorming → implementasyon)
**Kapsam:** helm web (`apps/web`)

## Problem

CMS'te DB'den gelen JSONB veri (`cms_entries.data`) bugün `json` kind için **ham textarea**
olarak gösteriliyor (`form-renderer.tsx:266`). Friday'in `en.json` bundle'ı 2000 satır →
textarea'da düzenlenemez. Önceki deneme (`inferSchema` → FieldDef ağacı → schema'yı DB'ye yaz)
**iki kaynak doğruluk** yarattığı için geri alındı (`4921603`): türetilen schema gerçek
data'dan drift ediyor, inference lossy/kırılgan.

## Karar: data-first, schema-less, path-addressed

Schema katmanını bu mod için tamamen at. `data` objesini **doğrudan** recursive gez; her key bir
alan, her value runtime tipine göre kontrol. **Veri = UI.** Inference yok, ayrı schema yok,
drift yok. Aynı şekli geri yaz.

- **Kapsam:** Generic bağımsız `<KeyValueEditor/>` bileşeni; ilk olarak CMS'e takılır, sonra
  cockpit'te her yere takılabilir. CMS internals'ı görmez.
- **Düzenleme:** Tam yapısal — value set + key ekle/sil/yeniden adlandır + dizi insert/remove/move
  + retype.

## Mimari

```
Supabase cms_entries.data (JSONB)
   │ useOne (oku)
   ▼
 parent state (data)  ◄──── onChange(applyOp(value, op))  ────┐  tek doğruluk = parent
   │ render                                                    │
   ▼                                                           │
 <KeyValueEditor value onChange/>                              │
   └─ <ValueNode value path/>  (recursive, dispatch context) ──┘
        ├─ string  → Input / Textarea (uzun/çok satır → textarea)
        ├─ number  → Input[number]
        ├─ boolean → Switch
        ├─ null    → rozet + type-switch
        ├─ array   → liste(ValueNode[i]) + insert/remove/move
        └─ object  → satırlar(KeyEditor + ValueNode[key]) + addKey/rename/removeKey
   │ onChange (şekil zaten doğru)
   ▼
 useUpdate({ data })  → revisions / publish  (mevcut akış aynen)
```

**İletişim sözleşmesi:** CMS ↔ editör sınırı yalnızca `(value, onChange)`. Tam yapısal op'lar
editörün içinde kalır; dışarı `onChange(nextWholeTree)` olarak çıkar. Generic'liğin sırrı bu.

## Bileşen sınırları (`apps/web/src/components/key-value-editor/`)

| Dosya | Sorumluluk | Bağımlılık |
|-------|-----------|-----------|
| `types.ts` | `JsonValue`, `Path`, `KvOp`, `JsonType` | yok |
| `ops.ts` | saf `applyOp(tree, op)` reducer + tip yardımcıları | `types.ts` |
| `ops.test.ts` | `applyOp` birim testleri (kritik mantık) | `ops.ts` (bun test) |
| `key-value-editor.tsx` | controlled top-level, dispatch context | `ops`, `value-node` |
| `value-node.tsx` | runtime tipe göre dispatcher | leaf/object/array node |
| `leaf-node.tsx` | primitive input + type-switcher | ui primitives |
| `object-node.tsx` | object container + KeyEditor (rename) | value-node |
| `array-node.tsx` | array container + move/remove | value-node |

## Op seti (discriminated union)

```ts
type KvOp =
  | { op: "set";        path: Path; value: JsonValue }
  | { op: "rename";     path: Path; key: string; newKey: string }  // sıra korunur
  | { op: "addKey";     path: Path; key: string; value: JsonValue }
  | { op: "removeKey";  path: Path; key: string }
  | { op: "insertItem"; path: Path; index: number; value: JsonValue }
  | { op: "removeItem"; path: Path; index: number }
  | { op: "moveItem";   path: Path; from: number; to: number }
  | { op: "retype";     path: Path; to: JsonType };                // coerce
```

`applyOp` structural-sharing: path boyunca klon, O(derinlik × o seviyedeki key sayısı), ağacın
tamamı değil.

## Kritik detaylar (reverted koddan ders)

1. **Rename order'ı bozmaz.** `delete+set` key'i sona atar; `applyOp` entries'i map'leyip yerinde
   takas eder, pozisyonu korur.
2. **Key edit local draft, commit on blur.** Her tuşta `rename` dispatch edersen path değişir →
   React subtree'yi remount eder → focus kaçar. KeyEditor yereldir, blur/Enter'da commit eder.
3. **Duplicate key guard.** rename/addKey hedef key zaten varsa no-op.
4. **retype coercion.** string→object `{}`, →array `[]`, →number `Number(old)||0`, →boolean
   `Boolean(old)`, →null `null`.

## Perf (2000 satırlık en.json)

- **Collapsible** object/array node (kapalı = render yok) — en büyük kazanç.
- Hover-revealed aksiyon kümesi (type/delete/move) — temiz görünüm, `group-hover`.
- Immutable apply O(derinlik), full-tree klon değil.

## Güvenlik ağı (tam yapısal foot-gun)

Tam yapısal editör tüketici siteyi (Friday typed frontend) kırabilir. **Yayın öncesi yapısal diff:**
son `cms_revisions` snapshot'ına karşı eklenen/silinen/yeniden adlandırılan/retype edilen key'leri
göster, onaylat. İkinci artifact icat etmeden (mevcut revision'a diff). → İlk slice'tan sonraki adım.

## Test (kritik mantık, regresyon — obsesyon yok)

Yalnızca `applyOp`: set / rename-order-preserve / addKey / removeKey / insert / remove / move /
retype-coercion / dup-key-guard / null / nested-path / immutability (girdi mutasyona uğramaz).

## Edge cases

`null` (nullable + type-switch), boş `{}`/`[]` ("ilk key/öğe ekle" affordance), duplicate key
(guard), derin nesting (indent + collapse), primitive'e giden path (no-op).

## Entegrasyon

`form-renderer.tsx` `json` kind → `<KeyValueEditor value={value ?? {}} onChange={onChange}/>`.
Friday `site-bundle` (singleton, tek `json` field `bundle`) anında yapısal forma döner.

## v1 dışı (not)

- Opsiyonel per-path **hint** (`{"hero.body":"richtext"}`) — leaf'i zenginleştirir, asla zorunlu
  değil, asla infer edilmez. Schema-drift'i geri getirmeden FieldDef'in iyi kısmını kurtarır.
- dnd-kit ile dizi reorder (v1: up/down buttons), array için stable-id memo, sanal liste.
