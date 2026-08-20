// helm - CMS dinamik form renderer.
// schema.fields[] → shadcn input map. Recursive list desteği.

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssetPicker } from "@/components/cms/asset-picker";
import { CmsPlateEditor } from "@/components/cms/plate-editor";
import { slugify } from "@/pages/projects/schema";
import type { CollectionSchema, FieldDef } from "@/types/cms";

interface FormRendererProps {
  projectId: string;
  schema: CollectionSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export const FormRenderer = ({
  projectId,
  schema,
  value,
  onChange,
}: FormRendererProps) => {
  const setField = (name: string, next: unknown) =>
    onChange({ ...value, [name]: next });

  return (
    <div className="flex flex-col gap-4">
      {schema.fields.map((field) => (
        <FieldRow
          key={field.name}
          field={field}
          projectId={projectId}
          value={value[field.name]}
          onChange={(next) => setField(field.name, next)}
          siblings={value}
        />
      ))}
      {schema.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Bu şemada henüz alan yok. Önce şemayı düzenle.
        </p>
      )}
    </div>
  );
};

interface FieldRowProps {
  field: FieldDef;
  projectId: string;
  value: unknown;
  onChange: (next: unknown) => void;
  siblings: Record<string, unknown>;
}

const FieldRow = ({ field, projectId, value, onChange, siblings }: FieldRowProps) => {
  const id = `cms-field-${field.name}`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <FieldInput
        id={id}
        field={field}
        projectId={projectId}
        value={value}
        onChange={onChange}
        siblings={siblings}
      />
      {field.help && (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      )}
    </div>
  );
};

interface InputProps extends FieldRowProps {
  id: string;
}

const FieldInput = ({ id, field, projectId, value, onChange, siblings }: InputProps) => {
  switch (field.kind) {
    case "text":
      return (
        <Input
          id={id}
          value={(value as string) ?? ""}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          rows={field.rows ?? 4}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "slug": {
      const sourceVal =
        field.source && typeof siblings[field.source] === "string"
          ? (siblings[field.source] as string)
          : "";
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ornek-slug"
          />
          {field.source && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(slugify(sourceVal))}
              disabled={!sourceVal}
            >
              Otomatik
            </Button>
          )}
        </div>
      );
    }

    case "number":
      return (
        <Input
          id={id}
          type="number"
          value={(value as number) ?? 0}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );

    case "boolean":
      return (
        <Switch
          id={id}
          checked={!!value}
          onCheckedChange={(c) => onChange(c)}
        />
      );

    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "image": {
      const url = (value as string) ?? "";
      return (
        <div className="flex flex-col gap-2">
          <Input
            id={id}
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… veya /gorsel.svg"
          />
          {url.trim() && (
            // onError: helm'de çözülemeyen göreli path'lerde önizlemeyi gizle.
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-20 w-auto max-w-[180px] rounded-md border object-contain bg-muted/30 p-1"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              onLoad={(e) => {
                e.currentTarget.style.display = "";
              }}
            />
          )}
        </div>
      );
    }

    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "asset":
      return (
        <AssetPicker
          projectId={projectId}
          value={(value as string | null) ?? null}
          onChange={(assetId) => onChange(assetId)}
        />
      );

    case "ref":
      // V1: basit text input (UUID); V1.5'te ref collection lookup
      return (
        <Input
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${field.collection} entry id`}
        />
      );

    case "list": {
      const items = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1">
                <FieldInput
                  id={`${id}-${idx}`}
                  field={field.of}
                  projectId={projectId}
                  value={item}
                  onChange={(next) => {
                    const arr = [...items];
                    arr[idx] = next;
                    onChange(arr);
                  }}
                  siblings={siblings}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...items, defaultForField(field.of)])}
          >
            <Plus className="size-4" /> Öğe ekle
          </Button>
        </div>
      );
    }

    case "object": {
      // Nested grup - alt FieldDef'leri value (alt-obje) üzerine recursive render.
      // Üst seviye bölümleme SectionedForm'da; bu, bölüm İÇİ derin nesting içindir.
      const obj =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      return (
        <div className="flex flex-col gap-4 rounded-md border border-border/60 p-3">
          {field.fields.map((f) => (
            <FieldRow
              key={f.name}
              field={f}
              projectId={projectId}
              value={obj[f.name]}
              onChange={(next) => onChange({ ...obj, [f.name]: next })}
              siblings={obj}
            />
          ))}
          {field.fields.length === 0 && (
            <p className="text-xs italic text-muted-foreground">empty group</p>
          )}
        </div>
      );
    }

    case "richtext":
      return (
        <CmsPlateEditor
          value={(value as never) ?? null}
          onChange={(next) => onChange(next)}
        />
      );

    case "json":
      // Şemasız serbest leaf için fallback (inference sonrası nadir). Ham JSON textarea.
      return (
        <Textarea
          id={id}
          value={JSON.stringify(value ?? {}, null, 2)}
          rows={6}
          className="font-mono text-xs"
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
        />
      );
  }
};

const defaultForField = (field: FieldDef): unknown => {
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
      for (const f of field.fields) obj[f.name] = defaultForField(f);
      return obj;
    }
    case "richtext":
      return [{ type: "p", children: [{ text: "" }] }];
    case "json":
      return {};
  }
};
