// helm — CMS dinamik şema → runtime Zod validator + boş entry üretici.

import { z, type ZodTypeAny } from "zod";
import type { CollectionSchema, FieldDef } from "@/types/cms";

const fieldToZod = (field: FieldDef): ZodTypeAny => {
  let schema: ZodTypeAny;
  switch (field.kind) {
    case "text":
    case "textarea":
    case "slug": {
      let s = z.string();
      if ("max" in field && field.max) s = s.max(field.max);
      schema = s;
      break;
    }
    case "number": {
      let s = z.number();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      schema = s;
      break;
    }
    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.string();
      break;
    case "image":
      schema = z.string();
      break;
    case "select":
      schema = z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
      break;
    case "asset":
      schema = z.string().uuid().nullable();
      break;
    case "list":
      schema = z.array(fieldToZod(field.of));
      break;
    case "object": {
      const shape: Record<string, ZodTypeAny> = {};
      for (const f of field.fields) shape[f.name] = fieldToZod(f);
      schema = z.object(shape);
      break;
    }
    case "ref":
      schema = z.string().uuid().nullable();
      break;
    case "richtext":
    case "json":
      schema = z.any();
      break;
  }

  if (!field.required) {
    schema = schema.optional().nullable();
  }
  return schema;
};

export const buildZodSchema = (schema: CollectionSchema) => {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of schema.fields) {
    shape[field.name] = fieldToZod(field);
  }
  return z.object(shape);
};

const fieldDefault = (field: FieldDef): unknown => {
  switch (field.kind) {
    case "text":
    case "textarea":
    case "slug":
    case "date":
    case "image":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "select":
      return field.options[0]?.value ?? "";
    case "asset":
    case "ref":
      return null;
    case "list":
      return [];
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const f of field.fields) obj[f.name] = fieldDefault(f);
      return obj;
    }
    case "richtext":
      return [{ type: "p", children: [{ text: "" }] }];
    case "json":
      return {};
  }
};

export const defaultEntryData = (schema: CollectionSchema): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  for (const field of schema.fields) {
    data[field.name] = fieldDefault(field);
  }
  return data;
};
