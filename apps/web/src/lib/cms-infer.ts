// helm — CMS şema çıkarımı: örnek JSON'(lar)dan FieldDef ağacı türetir.
// "schema-derived-from-data": yapı veriye göre çıkar; çıktı TASLAKTIR, insan onayı
// schema-designer'da düzeltir (string→slug/date yanlış tahminini orada yakalar).
//
// Karmaşıklık: Time O(N·K) (N = örnek sayısı, K = ağaçtaki toplam düğüm) — girdi
// boyutunda lineer; her düğüm örnek başına bir kez ziyaret edilir. Space O(K) (şema ağacı).

import type { FieldDef } from "@/types/cms";

const MAX_DEPTH = 3; // nesting guard (spec §6) — daha derini json'a düşer
const RESERVED_TOP = new Set(["_meta"]); // sistem metadata'sı (lang/updated), content değil

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

// snake_case / kebab-case / camelCase → "Title Case" (insan-okunur label)
const humanize = (key: string): string =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// String değer kümesinden primitive kind seç (heuristik; insan onayı düzeltir).
const stringKind = (values: string[]): "date" | "textarea" | "text" => {
  if (values.length > 0 && values.every((s) => ISO_DATE.test(s))) return "date";
  if (values.some((s) => s.length > 80 || s.includes("\n"))) return "textarea";
  return "text";
};

// Bir key'in (birden çok örnekteki) değerlerinden tek FieldDef üret.
const inferField = (
  name: string,
  values: unknown[],
  required: boolean,
  depth: number,
): FieldDef => {
  const base = { name, label: humanize(name), required };
  const nonNull = values.filter((v) => v !== null && v !== undefined);

  // Derinlik aşıldı ya da hiç somut değer yok → güvenli json fallback.
  if (depth > MAX_DEPTH || nonNull.length === 0) {
    return { ...base, kind: "json" };
  }

  if (nonNull.every(isPlainObject)) {
    const fields = inferFields(nonNull as Record<string, unknown>[], depth + 1, false);
    return { ...base, kind: "object", fields };
  }
  if (nonNull.every((v) => Array.isArray(v))) {
    // Tüm array elemanlarını birleştir → tek `of` FieldDef çıkar. Liste sarmalayıcısı
    // ayrı bir nesting seviyesi sayılmaz (asıl derinlik object'te) — depth artırılmaz.
    const elements = (nonNull as unknown[][]).flat();
    const of = inferField("item", elements, true, depth);
    return { ...base, kind: "list", of };
  }
  if (nonNull.every((v) => typeof v === "string")) {
    return { ...base, kind: stringKind(nonNull as string[]) };
  }
  if (nonNull.every((v) => typeof v === "number")) {
    return { ...base, kind: "number" };
  }
  if (nonNull.every((v) => typeof v === "boolean")) {
    return { ...base, kind: "boolean" };
  }

  // Karışık tip — FieldDef union ifade edemez → bilinçli json fallback.
  return { ...base, kind: "json" };
};

// Bir obje kümesinin key birleşiminden FieldDef[] üret. required = key TÜM örneklerde varsa.
const inferFields = (
  objects: Record<string, unknown>[],
  depth: number,
  topLevel: boolean,
): FieldDef[] => {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const o of objects) {
    for (const k of Object.keys(o)) {
      if (topLevel && RESERVED_TOP.has(k)) continue;
      if (!seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    }
  }
  return order.map((key) => {
    const present = objects.filter((o) => Object.prototype.hasOwnProperty.call(o, key));
    const required = present.length === objects.length;
    const values = present.map((o) => o[key]);
    return inferField(key, values, required, depth);
  });
};

// Public: örnek obje(ler)den koleksiyon şeması (top-level FieldDef[]) çıkar.
// Her sample bir top-level içerik objesi; çoğu örnek → required birleşimi daha doğru.
export const inferSchema = (samples: unknown[]): FieldDef[] => {
  const objects = samples.filter(isPlainObject);
  if (objects.length === 0) return [];
  return inferFields(objects, 1, true);
};

// Kolaylık: tek JSON değeri (obje ya da obje dizisi) → FieldDef[].
export const inferSchemaFromJson = (json: unknown): FieldDef[] =>
  inferSchema(Array.isArray(json) ? json : [json]);
