// helm — ingest çekirdeği testleri: inferSchema + mergeSchema (governance'ın doğruluğu).
// Çalıştır: bun test apps/web/src/lib/cms-pipeline.test.ts

import { describe, expect, it } from "bun:test";
import { inferSchema } from "./cms-infer";
import { mergeSchema } from "./cms-merge";
import type { CollectionSchema, FieldDef } from "../types/cms";

const sample = {
  _meta: { lang: "en", updated: "2026-06-01" },
  title: "Hi",
  body: "x".repeat(120),
  count: 3,
  live: true,
  date: "2026-06-01",
  tags: ["a", "b"],
  hero: { heading: "Welcome", cta: { label: "Go", href: "/go" } },
  items: [{ name: "A", qty: 1 }],
};

const byName = (fields: FieldDef[], name: string) => fields.find((f) => f.name === name)!;

describe("inferSchema", () => {
  const fields = inferSchema([sample]);

  it("_meta'yı top-level'da dışlar", () => {
    expect(fields.find((f) => f.name === "_meta")).toBeUndefined();
  });

  it("primitive kind'ları doğru seçer", () => {
    expect(byName(fields, "title").kind).toBe("text");
    expect(byName(fields, "body").kind).toBe("textarea"); // uzun string
    expect(byName(fields, "count").kind).toBe("number");
    expect(byName(fields, "live").kind).toBe("boolean");
    expect(byName(fields, "date").kind).toBe("date"); // ISO
  });

  it("object → nested fields, label humanize", () => {
    const hero = byName(fields, "hero");
    expect(hero.kind).toBe("object");
    if (hero.kind === "object") {
      expect(hero.label).toBe("Hero");
      const cta = byName(hero.fields, "cta");
      expect(cta.kind).toBe("object");
    }
  });

  it("dizi → list of (object/text)", () => {
    const tags = byName(fields, "tags");
    expect(tags.kind).toBe("list");
    if (tags.kind === "list") expect(tags.of.kind).toBe("text");
    const items = byName(fields, "items");
    if (items.kind === "list") expect(items.of.kind).toBe("object");
  });

  it("required = key tüm örneklerde varsa", () => {
    const f2 = inferSchema([{ a: 1 }, { a: 1, b: 2 }]);
    expect(byName(f2, "a").required).toBe(true);
    expect(byName(f2, "b").required).toBe(false);
  });
});

describe("mergeSchema — governance", () => {
  const inferred = inferSchema([sample]);

  it("ilk ingest → hepsi added, fields = inferred", () => {
    const { fields, report } = mergeSchema(null, inferred);
    expect(fields).toBe(inferred);
    expect(report.added).toContain("title");
    expect(report.added).toContain("hero.cta.label"); // nested path
  });

  it("aynı kaynak tekrar → added yok, alanlar korunur", () => {
    const first = mergeSchema(null, inferred).fields;
    const { report } = mergeSchema({ fields: first }, inferred);
    expect(report.added).toEqual([]);
    expect(report.conflicts).toEqual([]);
  });

  it("yeni kaynak alanı → added", () => {
    const existing: CollectionSchema = { fields: inferSchema([{ title: "x" }]) };
    const next = inferSchema([{ title: "x", subtitle: "y" }]);
    const { fields, report } = mergeSchema(existing, next);
    expect(report.added).toEqual(["subtitle"]);
    expect(fields.map((f) => f.name).sort()).toEqual(["subtitle", "title"]);
  });

  it("kaynakta silinen alan → korunur + raporlanır", () => {
    const existing: CollectionSchema = { fields: inferSchema([{ title: "x", legacy: "z" }]) };
    const next = inferSchema([{ title: "x" }]);
    const { fields, report } = mergeSchema(existing, next);
    expect(report.removed).toEqual(["legacy"]);
    expect(byName(fields, "legacy")).toBeDefined(); // otomatik silinmedi
  });

  it("dev tweak'i korunur: existing select vs inferred text", () => {
    const existing: CollectionSchema = {
      fields: [{ name: "status", label: "Durum", kind: "select", options: [{ value: "a", label: "A" }] }],
    };
    const inferredText = inferSchema([{ status: "a" }]); // tek örnek → text
    const { fields, report } = mergeSchema(existing, inferredText);
    expect(byName(fields, "status").kind).toBe("select"); // text'e EZİLMEDİ
    expect(report.conflicts.length).toBe(1); // çakışma raporlandı
  });

  it("nested object'e yeni alan eklenir (recurse)", () => {
    const existing: CollectionSchema = { fields: inferSchema([{ hero: { a: "1" } }]) };
    const next = inferSchema([{ hero: { a: "1", b: "2" } }]);
    const { fields, report } = mergeSchema(existing, next);
    expect(report.added).toContain("hero.b");
    const hero = byName(fields, "hero");
    if (hero.kind === "object") expect(byName(hero.fields, "b")).toBeDefined();
  });
});
