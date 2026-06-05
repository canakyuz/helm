// helm — key-value editor: JSON değer modeli + yapısal op union.
// Schema-less: tip render anında runtime değerden türetilir, saklanmaz.

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type JsonType = "string" | "number" | "boolean" | "null" | "object" | "array";

// Path: object key (string) veya array index (number) zinciri. [] = kök.
export type Path = (string | number)[];

// Tam yapısal op'lar. path, op'un hedef düğümünü/kabını adresler.
//  - set/retype: path düğümün KENDİSİ
//  - rename/addKey/removeKey: path parent OBJECT, key çocuk
//  - insertItem/removeItem/moveItem: path parent ARRAY
export type KvOp =
  | { op: "set"; path: Path; value: JsonValue }
  | { op: "rename"; path: Path; key: string; newKey: string }
  | { op: "addKey"; path: Path; key: string; value: JsonValue }
  | { op: "removeKey"; path: Path; key: string }
  | { op: "insertItem"; path: Path; index: number; value: JsonValue }
  | { op: "removeItem"; path: Path; index: number }
  | { op: "moveItem"; path: Path; from: number; to: number }
  | { op: "retype"; path: Path; to: JsonType };
