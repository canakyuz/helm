// helm — key-value editor: saf reducer + tip yardımcıları.
// applyOp(tree, op) immutable yeni ağaç döner. immer YOK — elde structural sharing.
//
// Karmaşıklık: updateAt path boyunca klonlar → O(D · K̄) (D=derinlik, K̄=yoldaki
// seviyelerin ortalama key/öğe sayısı). Ağacın tamamı değil. Space: O(D · K̄) yeni düğüm.

import type { JsonArray, JsonObject, JsonType, JsonValue, KvOp, Path } from "./types";

export const jsonTypeOf = (value: JsonValue): JsonType => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as "string" | "number" | "boolean" | "object";
};

export const isObject = (value: JsonValue): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Bir tipin boş/varsayılan değeri.
export const emptyForType = (type: JsonType): JsonValue => {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    case "object":
      return {};
    case "array":
      return [];
  }
};

// retype: mevcut değeri hedef tipe makul şekilde coerce et (veri kaybını azalt).
const coerce = (prev: JsonValue, to: JsonType): JsonValue => {
  switch (to) {
    case "string":
      return prev === null || typeof prev === "object" ? "" : String(prev);
    case "number": {
      const n = Number(prev);
      return Number.isFinite(n) ? n : 0;
    }
    case "boolean":
      return Boolean(prev);
    case "null":
      return null;
    case "object":
      return isObject(prev) ? prev : {};
    case "array":
      return Array.isArray(prev) ? prev : [];
  }
};

// Object key'ini sırasını koruyarak yeniden adlandır (delete+set sona atardı).
const renameKey = (obj: JsonObject, key: string, newKey: string): JsonObject => {
  if (key === newKey || !(key in obj) || newKey in obj) return obj; // dup/no-op guard
  const out: JsonObject = {};
  for (const k of Object.keys(obj)) {
    out[k === key ? newKey : k] = obj[k];
  }
  return out;
};

// path'teki düğümü fn(old) ile değiştirip yeni ağaç döner. Yol boyunca klonlar.
const updateAt = (
  node: JsonValue,
  path: Path,
  fn: (n: JsonValue) => JsonValue,
): JsonValue => {
  if (path.length === 0) return fn(node);
  const [head, ...rest] = path;

  if (Array.isArray(node) && typeof head === "number") {
    if (head < 0 || head >= node.length) return node; // sınır dışı: no-op
    const copy = node.slice();
    copy[head] = updateAt(node[head], rest, fn);
    return copy;
  }
  if (isObject(node) && typeof head === "string") {
    if (!(head in node)) return node; // eksik key: no-op
    return { ...node, [head]: updateAt(node[head], rest, fn) };
  }
  return node; // primitive'e giden path: no-op
};

export const applyOp = (tree: JsonValue, op: KvOp): JsonValue => {
  switch (op.op) {
    case "set":
      return updateAt(tree, op.path, () => op.value);

    case "retype":
      return updateAt(tree, op.path, (old) => coerce(old, op.to));

    case "rename":
      return updateAt(tree, op.path, (node) =>
        isObject(node) ? renameKey(node, op.key, op.newKey) : node,
      );

    case "addKey":
      return updateAt(tree, op.path, (node) =>
        isObject(node) && !(op.key in node)
          ? { ...node, [op.key]: op.value }
          : node,
      );

    case "removeKey":
      return updateAt(tree, op.path, (node) => {
        if (!isObject(node) || !(op.key in node)) return node;
        const out: JsonObject = {};
        for (const k of Object.keys(node)) {
          if (k !== op.key) out[k] = node[k];
        }
        return out;
      });

    case "insertItem":
      return updateAt(tree, op.path, (node) => {
        if (!Array.isArray(node)) return node;
        const i = Math.max(0, Math.min(op.index, node.length));
        return [...node.slice(0, i), op.value, ...node.slice(i)] as JsonArray;
      });

    case "removeItem":
      return updateAt(tree, op.path, (node) =>
        Array.isArray(node) ? node.filter((_, i) => i !== op.index) : node,
      );

    case "moveItem":
      return updateAt(tree, op.path, (node) => {
        if (!Array.isArray(node)) return node;
        const { from, to } = op;
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= node.length ||
          to >= node.length
        ) {
          return node;
        }
        const copy = node.slice();
        const [moved] = copy.splice(from, 1);
        copy.splice(to, 0, moved);
        return copy;
      });
  }
};
