// helm — CMS modülü tipleri
// Schema-as-data: cms_collections.schema jsonb FieldDef[] içerir.

import type { Value as PlateValue } from "platejs";

export type CollectionKind = "collection" | "singleton";
export type EntryStatus = "draft" | "published";

export interface FieldBase {
  name: string;
  label: string;
  required?: boolean;
  help?: string;
}

export type FieldDef =
  | (FieldBase & { kind: "text"; max?: number })
  | (FieldBase & { kind: "textarea"; rows?: number; max?: number })
  | (FieldBase & { kind: "slug"; source?: string })
  | (FieldBase & { kind: "number"; min?: number; max?: number })
  | (FieldBase & { kind: "boolean" })
  | (FieldBase & { kind: "date" })
  | (FieldBase & {
      kind: "select";
      options: { value: string; label: string }[];
    })
  | (FieldBase & { kind: "asset"; accept?: string })
  | (FieldBase & { kind: "image" }) // URL/path string + önizleme (asset UUID ref'ten farklı)
  | (FieldBase & { kind: "list"; of: FieldDef })
  | (FieldBase & { kind: "object"; fields: FieldDef[] })
  | (FieldBase & { kind: "ref"; collection: string })
  | (FieldBase & { kind: "richtext" })
  | (FieldBase & { kind: "json" });

export interface CollectionSchema {
  fields: FieldDef[];
}

export interface CmsCollection {
  id: string;
  project_id: string;
  slug: string;
  label: string;
  kind: CollectionKind;
  schema: CollectionSchema;
  created_at: string;
  updated_at: string;
}

export interface CmsEntry {
  id: string;
  collection_id: string;
  project_id: string;
  slug: string;
  locale: string;
  status: EntryStatus;
  data: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CmsRevision {
  id: number;
  entry_id: string;
  data: Record<string, unknown>;
  status_at_snapshot: EntryStatus | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export interface CmsAsset {
  id: string;
  project_id: string;
  storage_path: string;
  filename: string;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  created_at: string;
  created_by: string | null;
}

export type RichTextValue = PlateValue;

export interface CmsPublishTarget {
  name: string;
  url: string;
  secret: string;
  locales?: string[];
}

export interface CmsPublishResult {
  target: string;
  ok: boolean;
  status: number;
  error?: string;
}

