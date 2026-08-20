// helm - CMS şema merge: ingest tekrar çalıştığında NON-DESTRUCTIVE birleştirme.
// Var olanı koru (dev tweak'leri: kind/label/select options) · yeni alanı ekle ·
// object/list-of-object içine recurse · kaynakta silineni RAPORLA (otomatik silme yok) ·
// kind çakışmasını raporla (mevcut korunur). Drift governance'ın "güncelleme" yolu.
//
// Karmaşıklık: Time O(M) (M = iki taraftaki toplam alan) · Space O(M) (merged ağaç).

import type { CollectionSchema, FieldDef } from "@/types/cms";

export interface MergeReport {
  added: string[]; // kaynakta yeni → eklendi (path)
  removed: string[]; // kaynakta yok ama şemada var → korundu (path)
  conflicts: string[]; // kind çakışması → mevcut korundu (path)
}

export interface MergeResult {
  fields: FieldDef[];
  report: MergeReport;
}

// object / list-of-object alanlarının çocuk FieldDef[]'i (recurse hedefi).
const childFields = (f: FieldDef): FieldDef[] | null => {
  if (f.kind === "object") return f.fields;
  if (f.kind === "list" && f.of.kind === "object") return f.of.fields;
  return null;
};

const rewriteChildren = (f: FieldDef, children: FieldDef[]): FieldDef => {
  if (f.kind === "object") return { ...f, fields: children };
  if (f.kind === "list" && f.of.kind === "object") {
    return { ...f, of: { ...f.of, fields: children } };
  }
  return f;
};

const mergeLevel = (
  existing: FieldDef[],
  inferred: FieldDef[],
  prefix: string,
  report: MergeReport,
): FieldDef[] => {
  const exByName = new Map(existing.map((f) => [f.name, f]));
  const infByName = new Set(inferred.map((f) => f.name));
  const out: FieldDef[] = [];

  // 1) inferred sırasını koru: yeni ekle, var olanı tut, nested birleştir.
  for (const inf of inferred) {
    const path = prefix ? `${prefix}.${inf.name}` : inf.name;
    const ex = exByName.get(inf.name);
    if (!ex) {
      report.added.push(path);
      out.push(inf);
      continue;
    }
    if (ex.kind !== inf.kind) {
      report.conflicts.push(`${path} (${ex.kind} ↔ ${inf.kind})`);
      out.push(ex); // mevcut korunur, dev manuel çözer
      continue;
    }
    const exCh = childFields(ex);
    const infCh = childFields(inf);
    if (exCh && infCh) {
      out.push(rewriteChildren(ex, mergeLevel(exCh, infCh, path, report)));
    } else {
      out.push(ex); // aynı kind, leaf → mevcut (label/select tweak) korunur
    }
  }

  // 2) kaynakta olmayan mevcut alanlar: koru + raporla (sona).
  for (const ex of existing) {
    if (!infByName.has(ex.name)) {
      report.removed.push(prefix ? `${prefix}.${ex.name}` : ex.name);
      out.push(ex);
    }
  }

  return out;
};

export const mergeSchema = (
  existing: CollectionSchema | null | undefined,
  inferred: FieldDef[],
): MergeResult => {
  const report: MergeReport = { added: [], removed: [], conflicts: [] };

  // İlk ingest: tüm inferred ağaç "added".
  if (!existing || existing.fields.length === 0) {
    const walk = (fields: FieldDef[], prefix: string): void => {
      for (const f of fields) {
        const path = prefix ? `${prefix}.${f.name}` : f.name;
        report.added.push(path);
        const ch = childFields(f);
        if (ch) walk(ch, path);
      }
    };
    walk(inferred, "");
    return { fields: inferred, report };
  }

  return { fields: mergeLevel(existing.fields, inferred, "", report), report };
};
