// helm — key-value editor: object container.
// Satır = key→value. Leaf inline, container alt blokta (collapsible). Rename local-draft.

import { memo, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { samePath, useKvDispatch } from "./context";
import { LeafInput, TypeSwitch } from "./leaf-node";
import { isObject, jsonTypeOf } from "./ops";
import type { JsonObject, JsonValue, Path } from "./types";
import { CollapseToggle, ValueNode } from "./value-node";

const containerSummary = (v: JsonValue): string =>
  Array.isArray(v) ? `[${v.length}]` : isObject(v) ? `{${Object.keys(v).length}}` : "";

export const ObjectNode = ({ value, path }: { value: JsonObject; path: Path }) => {
  const keys = Object.keys(value);
  return (
    <div className="flex flex-col gap-0.5 border-l border-border/50 pl-2">
      {keys.length === 0 && (
        <span className="py-0.5 text-xs italic text-muted-foreground">boş obje</span>
      )}
      {keys.map((k) => (
        <PropertyRow key={k} parentPath={path} k={k} child={value[k]} />
      ))}
      <AddKey parentPath={path} existing={keys} />
    </div>
  );
};

interface PropertyRowProps {
  parentPath: Path;
  k: string;
  child: JsonValue;
}

const PropertyRowBase = ({ parentPath, k, child }: PropertyRowProps) => {
  const dispatch = useKvDispatch();
  const [open, setOpen] = useState(true);
  const childPath = [...parentPath, k];
  const container = isObject(child) || Array.isArray(child);

  return (
    <div className="group flex flex-col">
      <div className="flex items-center gap-1.5 py-0.5">
        {container ? (
          <CollapseToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            summary={containerSummary(child)}
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <KeyEditor parentPath={parentPath} k={k} />
        <span className="shrink-0 text-muted-foreground">:</span>
        {!container && (
          <div className="min-w-0 flex-1">
            <LeafInput value={child} path={childPath} />
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <TypeSwitch path={childPath} current={jsonTypeOf(child)} />
          <button
            type="button"
            onClick={() => dispatch({ op: "removeKey", path: parentPath, key: k })}
            className="text-muted-foreground hover:text-destructive"
            title="Sil"
            aria-label={`${k} sil`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {container && open && (
        <div className="pl-2">
          <ValueNode value={child} path={childPath} />
        </div>
      )}
    </div>
  );
};

const PropertyRow = memo(
  PropertyRowBase,
  (p, n) => p.k === n.k && p.child === n.child && samePath(p.parentPath, n.parentPath),
);

// Key etiketi: editable label. Local draft → blur/Enter'da rename dispatch (remount/focus guard).
const KeyEditor = ({ parentPath, k }: { parentPath: Path; k: string }) => {
  const dispatch = useKvDispatch();
  const [draft, setDraft] = useState(k);
  useEffect(() => setDraft(k), [k]);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === k) {
      setDraft(k);
      return;
    }
    dispatch({ op: "rename", path: parentPath, key: k, newKey: next });
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(k);
      }}
      spellCheck={false}
      className={cn(
        "min-w-0 shrink-0 rounded bg-transparent px-1 py-0.5 text-sm font-medium",
        "hover:bg-muted focus:bg-muted focus:outline-none",
      )}
      style={{ width: `${Math.max(2, draft.length + 1)}ch` }}
      aria-label="Anahtar adı"
    />
  );
};

const AddKey = ({ parentPath, existing }: { parentPath: Path; existing: string[] }) => {
  const dispatch = useKvDispatch();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const add = () => {
    const key = name.trim();
    if (!key || existing.includes(key)) return;
    dispatch({ op: "addKey", path: parentPath, key, value: "" });
    setName("");
    setAdding(false);
  };

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex w-fit items-center gap-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" /> anahtar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 py-0.5">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") {
            setName("");
            setAdding(false);
          }
        }}
        placeholder="anahtar adı"
        className="h-7 w-40 text-sm"
      />
      <button
        type="button"
        onClick={add}
        disabled={!name.trim() || existing.includes(name.trim())}
        className="text-xs text-foreground hover:underline disabled:text-muted-foreground"
      >
        ekle
      </button>
      <button
        type="button"
        onClick={() => {
          setName("");
          setAdding(false);
        }}
        className="text-xs text-muted-foreground hover:underline"
      >
        iptal
      </button>
    </div>
  );
};
