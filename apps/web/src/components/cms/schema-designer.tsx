// helm — CMS şema tasarımcısı. dnd-kit ile field reorder.
// FieldDef[] üzerinde CRUD; cms_collections.schema'nın editörü.

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CollectionSchema, FieldDef } from "@/types/cms";

const KIND_LABELS: Record<FieldDef["kind"], string> = {
  text: "Metin (text)",
  textarea: "Uzun metin (textarea)",
  slug: "Slug",
  number: "Number",
  boolean: "Anahtar (boolean)",
  date: "Tarih",
  select: "Choice list",
  asset: "Medya",
  image: "Image (with preview)",
  list: "List (repeatable)",
  object: "Grup (nested)",
  ref: "Referans",
  richtext: "Zengin metin (Plate)",
  json: "Serbest JSON",
};

const KIND_OPTIONS = Object.entries(KIND_LABELS) as [FieldDef["kind"], string][];

const makeField = (kind: FieldDef["kind"]): FieldDef => {
  const base = { name: "yeni_alan", label: "Yeni Alan", required: false };
  switch (kind) {
    case "select":
      return { ...base, kind, options: [{ value: "a", label: "A" }] };
    case "list":
      return { ...base, kind, of: { kind: "text", name: "item", label: "Item" } };
    case "object":
      return { ...base, kind, fields: [] };
    case "ref":
      return { ...base, kind, collection: "" };
    default:
      return { ...base, kind } as FieldDef;
  }
};

interface Props {
  value: CollectionSchema;
  onChange: (next: CollectionSchema) => void;
}

export const SchemaDesigner = ({ value, onChange }: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateField = (index: number, next: FieldDef) => {
    const fields = [...value.fields];
    fields[index] = next;
    onChange({ ...value, fields });
  };

  const removeField = (index: number) => {
    const fields = value.fields.filter((_, i) => i !== index);
    onChange({ ...value, fields });
  };

  const addField = (kind: FieldDef["kind"]) => {
    onChange({ ...value, fields: [...value.fields, makeField(kind)] });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.fields.findIndex((f) => f.name === active.id);
    const newIndex = value.fields.findIndex((f) => f.name === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...value, fields: arrayMove(value.fields, oldIndex, newIndex) });
  };

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={value.fields.map((f) => f.name)}
          strategy={verticalListSortingStrategy}
        >
          {value.fields.map((field, idx) => (
            <SortableFieldRow
              key={field.name + idx}
              field={field}
              onChange={(next) => updateField(idx, next)}
              onRemove={() => removeField(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {value.fields.length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Henüz alan yok. Aşağıdan ekle.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {KIND_OPTIONS.map(([kind, label]) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addField(kind)}
          >
            <Plus className="size-4" /> {label}
          </Button>
        ))}
      </div>
    </div>
  );
};

interface RowProps {
  field: FieldDef;
  onChange: (next: FieldDef) => void;
  onRemove: () => void;
}

const SortableFieldRow = ({ field, onChange, onRemove }: RowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-md border bg-card p-3"
    >
      <button
        type="button"
        className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="grid flex-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-3">
          <Label className="text-xs text-muted-foreground">Tip</Label>
          <Select
            value={field.kind}
            onValueChange={(v) => onChange({ ...field, kind: v } as FieldDef)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map(([kind, label]) => (
                <SelectItem key={kind} value={kind}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-3">
          <Label className="text-xs text-muted-foreground">Anahtar (name)</Label>
          <Input
            value={field.name}
            onChange={(e) => onChange({ ...field, name: e.target.value })}
            placeholder="ornek_alan"
          />
        </div>

        <div className="sm:col-span-4">
          <Label className="text-xs text-muted-foreground">Etiket</Label>
          <Input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
        </div>

        <div className="flex items-end gap-2 sm:col-span-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Zorunlu</Label>
            <Switch
              checked={!!field.required}
              onCheckedChange={(c) => onChange({ ...field, required: c })}
            />
          </div>
        </div>

        {field.kind === "ref" && (
          <div className="sm:col-span-12">
            <Label className="text-xs text-muted-foreground">Referans collection slug</Label>
            <Input
              value={field.collection}
              onChange={(e) => onChange({ ...field, collection: e.target.value })}
              placeholder="e.g. authors"
            />
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Sil"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
};
