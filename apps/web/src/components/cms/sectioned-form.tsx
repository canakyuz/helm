// helm — CMS iki-pane tipli panel + sağ panede drill-down.
// Sol ray: top-level bölümler (sabit). Sağ pane: seçili bölüm; object çocukları breadcrumb
// ile derinleşir (Pages › Home › Hero), leaf+list alanları o seviyede inline düzenlenir.
// Böylece "pages" gibi 21 sayfalık derin ağaç tek wall yerine gezinilebilir detay olur.

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormRenderer } from "@/components/cms/form-renderer";
import type { CollectionSchema, FieldDef } from "@/types/cms";

const GENERAL = "__general";

type Section =
  | { key: typeof GENERAL; label: string; fields: FieldDef[]; pick: "root" }
  | { key: string; label: string; fields: FieldDef[]; pick: "child"; childKey: string }
  | { key: string; label: string; fields: FieldDef[]; pick: "root" };

// Top-level bölümler: object → kendi alanları (data[name] slice'ı); list → tek alan (root slice);
// kalan leaf'ler "Genel"de (root slice).
const buildSections = (schema: CollectionSchema): Section[] => {
  const sections: Section[] = [];
  const leaves = schema.fields.filter((f) => f.kind !== "object" && f.kind !== "list");
  if (leaves.length) sections.push({ key: GENERAL, label: "Genel", fields: leaves, pick: "root" });
  for (const f of schema.fields) {
    if (f.kind === "object")
      sections.push({ key: f.name, label: f.label, fields: f.fields, pick: "child", childKey: f.name });
    else if (f.kind === "list")
      sections.push({ key: f.name, label: f.label, fields: [f], pick: "root" });
  }
  return sections;
};

const isObjectVal = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

// path boyunca immutable yaz (object zinciri; ara düğüm yoksa {} ile oluştur).
const setAtPath = (data: unknown, path: string[], slice: unknown): unknown => {
  if (path.length === 0) return slice;
  const [head, ...rest] = path;
  const node = isObjectVal(data) ? data : {};
  return { ...node, [head]: setAtPath(node[head], rest, slice) };
};

interface Props {
  projectId: string;
  schema: CollectionSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export const SectionedForm = ({ projectId, schema, value, onChange }: Props) => {
  const sections = buildSections(schema);
  const [active, setActive] = useState<string | null>(null);
  const activeKey = active ?? sections[0]?.key ?? null;
  const current = sections.find((s) => s.key === activeKey);

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Şema boş. Ingest çalıştır: <code className="text-xs">bun run ingest:&lt;target&gt;</code>
      </p>
    );
  }

  // Bölümün kök data slice'ı + o slice'a geri yazan onChange.
  let sectionValue: Record<string, unknown> = value;
  let sectionOnChange: (next: Record<string, unknown>) => void = onChange;
  if (current && current.pick === "child") {
    const ck = current.childKey;
    const raw = value[ck];
    sectionValue = isObjectVal(raw) ? raw : {};
    sectionOnChange = (next) => onChange({ ...value, [ck]: next });
  }

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <nav className="flex flex-col gap-0.5 md:border-r md:border-border/60 md:pr-3">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              s.key === activeKey
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                s.key === activeKey ? "bg-primary" : "bg-border",
              )}
            />
            <span className="truncate">{s.label}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {current && (
          <SectionDetail
            key={current.key}
            projectId={projectId}
            rootLabel={current.label}
            fields={current.fields}
            value={sectionValue}
            onChange={sectionOnChange}
          />
        )}
      </div>
    </div>
  );
};

interface DetailProps {
  projectId: string;
  rootLabel: string;
  fields: FieldDef[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// Bölüm içi drill-down: object çocukları breadcrumb ile derinleşir, leaf/list inline kalır.
const SectionDetail = ({ projectId, rootLabel, fields, value, onChange }: DetailProps) => {
  const [subPath, setSubPath] = useState<string[]>([]);

  // subPath'i çöz: her segment bir object çocuk; geçersizse o noktada dur.
  let curFields = fields;
  let curValue: Record<string, unknown> = value;
  const crumbs: { label: string; depth: number }[] = [{ label: rootLabel, depth: 0 }];
  for (let i = 0; i < subPath.length; i++) {
    const f = curFields.find((x) => x.name === subPath[i]);
    if (!f || f.kind !== "object") break;
    crumbs.push({ label: f.label, depth: i + 1 });
    curFields = f.fields;
    const child = curValue[subPath[i]];
    curValue = isObjectVal(child) ? child : {};
  }

  const navChildren = curFields.filter((f) => f.kind === "object");
  const inlineChildren = curFields.filter((f) => f.kind !== "object");

  const handleInline = (nextSlice: Record<string, unknown>) =>
    onChange(setAtPath(value, subPath, nextSlice) as Record<string, unknown>);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <Fragment key={c.depth}>
            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
            <button
              type="button"
              onClick={() => setSubPath(subPath.slice(0, c.depth))}
              className={cn(
                i === crumbs.length - 1
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          </Fragment>
        ))}
      </nav>

      {navChildren.length > 0 && (
        <div className="flex flex-col gap-1">
          {navChildren.map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => setSubPath([...subPath, f.name])}
              className="group flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="truncate font-medium">{f.label}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                {f.kind === "object" ? `${f.fields.length} alan` : ""}
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      {inlineChildren.length > 0 && (
        <FormRenderer
          projectId={projectId}
          schema={{ fields: inlineChildren }}
          value={curValue}
          onChange={handleInline}
        />
      )}

      {navChildren.length === 0 && inlineChildren.length === 0 && (
        <p className="text-sm text-muted-foreground">No fields in this section.</p>
      )}
    </div>
  );
};
