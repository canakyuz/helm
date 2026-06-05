// helm — applyOp birim testleri. Kritik mantık: immutability + rename order + guard'lar.
// Çalıştır: bun test apps/web/src/components/key-value-editor/ops.test.ts

import { describe, expect, it } from "bun:test";
import { applyOp, jsonTypeOf } from "./ops";
import type { JsonValue } from "./types";

const sample = (): JsonValue => ({
  hero: { title: "Merhaba", cta: { label: "Başla", href: "/start" } },
  tags: ["a", "b", "c"],
  count: 3,
  live: true,
});

describe("jsonTypeOf", () => {
  it("null/array/object/primitive ayırır", () => {
    expect(jsonTypeOf(null)).toBe("null");
    expect(jsonTypeOf([])).toBe("array");
    expect(jsonTypeOf({})).toBe("object");
    expect(jsonTypeOf("x")).toBe("string");
    expect(jsonTypeOf(1)).toBe("number");
    expect(jsonTypeOf(false)).toBe("boolean");
  });
});

describe("applyOp — immutability", () => {
  it("girdiyi mutasyona uğratmaz", () => {
    const tree = sample();
    const before = JSON.stringify(tree);
    applyOp(tree, { op: "set", path: ["hero", "title"], value: "X" });
    expect(JSON.stringify(tree)).toBe(before);
  });

  it("değişmeyen kardeşler referansı korur (structural sharing)", () => {
    const tree = sample() as { tags: unknown; hero: unknown };
    const next = applyOp(tree as JsonValue, {
      op: "set",
      path: ["hero", "title"],
      value: "X",
    }) as { tags: unknown; hero: unknown };
    expect(next.tags).toBe(tree.tags); // dokunulmadı → aynı ref
    expect(next.hero).not.toBe(tree.hero); // yol üstünde → yeni
  });
});

describe("applyOp — set", () => {
  it("nested leaf'i değiştirir", () => {
    const next = applyOp(sample(), {
      op: "set",
      path: ["hero", "cta", "label"],
      value: "Hadi",
    }) as { hero: { cta: { label: string } } };
    expect(next.hero.cta.label).toBe("Hadi");
  });

  it("array öğesini değiştirir", () => {
    const next = applyOp(sample(), {
      op: "set",
      path: ["tags", 1],
      value: "B",
    }) as { tags: string[] };
    expect(next.tags).toEqual(["a", "B", "c"]);
  });
});

describe("applyOp — rename (sıra korunur + guard)", () => {
  it("key'i yerinde yeniden adlandırır, pozisyonu korur", () => {
    const obj: JsonValue = { a: 1, b: 2, c: 3 };
    const next = applyOp(obj, { op: "rename", path: [], key: "b", newKey: "z" });
    expect(Object.keys(next as object)).toEqual(["a", "z", "c"]); // sona atmadı
  });

  it("hedef key zaten varsa no-op", () => {
    const obj: JsonValue = { a: 1, b: 2 };
    const next = applyOp(obj, { op: "rename", path: [], key: "a", newKey: "b" });
    expect(next).toEqual({ a: 1, b: 2 });
  });
});

describe("applyOp — addKey / removeKey", () => {
  it("yeni key ekler", () => {
    const next = applyOp(sample(), {
      op: "addKey",
      path: ["hero"],
      key: "subtitle",
      value: "alt",
    }) as { hero: Record<string, unknown> };
    expect(next.hero.subtitle).toBe("alt");
  });

  it("mevcut key'i ezmek için addKey no-op", () => {
    const next = applyOp({ a: 1 }, {
      op: "addKey",
      path: [],
      key: "a",
      value: 99,
    });
    expect(next).toEqual({ a: 1 });
  });

  it("key siler", () => {
    const next = applyOp(sample(), {
      op: "removeKey",
      path: ["hero"],
      key: "cta",
    }) as { hero: Record<string, unknown> };
    expect("cta" in next.hero).toBe(false);
    expect(next.hero.title).toBe("Merhaba");
  });
});

describe("applyOp — array insert/remove/move", () => {
  it("belirtilen index'e ekler", () => {
    const next = applyOp(sample(), {
      op: "insertItem",
      path: ["tags"],
      index: 1,
      value: "x",
    }) as { tags: string[] };
    expect(next.tags).toEqual(["a", "x", "b", "c"]);
  });

  it("sınır dışı index'i clamp eder", () => {
    const next = applyOp({ t: [] }, {
      op: "insertItem",
      path: ["t"],
      index: 99,
      value: "x",
    }) as { t: string[] };
    expect(next.t).toEqual(["x"]);
  });

  it("öğe siler", () => {
    const next = applyOp(sample(), {
      op: "removeItem",
      path: ["tags"],
      index: 0,
    }) as { tags: string[] };
    expect(next.tags).toEqual(["b", "c"]);
  });

  it("öğeyi taşır", () => {
    const next = applyOp(sample(), {
      op: "moveItem",
      path: ["tags"],
      from: 0,
      to: 2,
    }) as { tags: string[] };
    expect(next.tags).toEqual(["b", "c", "a"]);
  });
});

describe("applyOp — retype coercion", () => {
  it("string → object", () => {
    const next = applyOp({ x: "hi" }, { op: "retype", path: ["x"], to: "object" });
    expect((next as { x: unknown }).x).toEqual({});
  });

  it("string → number (parse), olmazsa 0", () => {
    expect((applyOp({ x: "42" }, { op: "retype", path: ["x"], to: "number" }) as { x: number }).x).toBe(42);
    expect((applyOp({ x: "abc" }, { op: "retype", path: ["x"], to: "number" }) as { x: number }).x).toBe(0);
  });

  it("object → string boş döner (kayıp coerce)", () => {
    const next = applyOp({ x: { a: 1 } }, { op: "retype", path: ["x"], to: "string" });
    expect((next as { x: unknown }).x).toBe("");
  });
});

describe("applyOp — no-op güvenliği", () => {
  it("primitive'e giden path sessizce no-op", () => {
    const tree = sample();
    const next = applyOp(tree, { op: "set", path: ["count", "nope"], value: 1 });
    expect(next).toEqual(tree);
  });
});
