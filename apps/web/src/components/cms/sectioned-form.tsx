// helm — CMS iki-pane tipli panel (master-detail).
// Sol: top-level bölüm listesi · Sağ: SADECE seçili bölümün alanları → ekranda sabit yük,
// 2000 satırlık bundle'da bile sakin. Render FormRenderer'a delege; bu sadece bölümleme.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FormRenderer } from "@/components/cms/form-renderer";
import type { CollectionSchema, FieldDef } from "@/types/cms";

const GENERAL = "__general";

type Section =
  | { key: typeof GENERAL; label: string; kind: "leaves"; fields: FieldDef[] }
  | { key: string; label: string; kind: "object"; field: Extract<FieldDef, { kind: "object" }> }
  | { key: string; label: string; kind: "single"; field: FieldDef };

// Bölümler: object → kendi alanları açılır; list → tek bölüm; kalan top-level leaf'ler "Genel"de.
const buildSections = (schema: CollectionSchema): Section[] => {
  const sections: Section[] = [];
  const leaves = schema.fields.filter((f) => f.kind !== "object" && f.kind !== "list");
  if (leaves.length) sections.push({ key: GENERAL, label: "Genel", kind: "leaves", fields: leaves });
  for (const f of schema.fields) {
    if (f.kind === "object") sections.push({ key: f.name, label: f.label, kind: "object", field: f });
    else if (f.kind === "list") sections.push({ key: f.name, label: f.label, kind: "single", field: f });
  }
  return sections;
};

interface Props {
  projectId: string;
  schema: CollectionSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export const SectionedForm = ({ projectId, schema, value, onChange }: Props) => {
  const sections = useMemo(() => buildSections(schema), [schema]);
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

      <div className="flex min-w-0 flex-col gap-4">
        {current && (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {current.label}
            </h3>
            <SectionBody section={current} projectId={projectId} value={value} onChange={onChange} />
          </>
        )}
      </div>
    </div>
  );
};

const SectionBody = ({
  section,
  projectId,
  value,
  onChange,
}: {
  section: Section;
  projectId: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) => {
  if (section.kind === "leaves") {
    return (
      <FormRenderer
        projectId={projectId}
        schema={{ fields: section.fields }}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (section.kind === "object") {
    const raw = value[section.key];
    const sub =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return (
      <FormRenderer
        projectId={projectId}
        schema={{ fields: section.field.fields }}
        value={sub}
        onChange={(next) => onChange({ ...value, [section.key]: next })}
      />
    );
  }

  // single (list vb.) — alan kendi label'ı + editörüyle render olur.
  return (
    <FormRenderer
      projectId={projectId}
      schema={{ fields: [section.field] }}
      value={value}
      onChange={onChange}
    />
  );
};
