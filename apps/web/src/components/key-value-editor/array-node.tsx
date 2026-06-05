// helm — key-value editor: array container.
// Satır = index→value. Leaf inline, container alt blokta. Move up/down (v1; dnd v1.1).

import { memo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { samePath, useKvDispatch } from "./context";
import { LeafInput, TypeSwitch } from "./leaf-node";
import { isObject, jsonTypeOf } from "./ops";
import type { JsonArray, JsonValue, Path } from "./types";
import { CollapseToggle, ValueNode } from "./value-node";

const containerSummary = (v: JsonValue): string =>
  Array.isArray(v) ? `[${v.length}]` : isObject(v) ? `{${Object.keys(v).length}}` : "";

export const ArrayNode = ({ value, path }: { value: JsonArray; path: Path }) => {
  const dispatch = useKvDispatch();
  return (
    <div className="flex flex-col gap-0.5 border-l border-border/50 pl-2">
      {value.length === 0 && (
        <span className="py-0.5 text-xs italic text-muted-foreground">boş dizi</span>
      )}
      {value.map((child, index) => (
        <ItemRow
          key={index}
          parentPath={path}
          index={index}
          child={child}
          count={value.length}
        />
      ))}
      <button
        type="button"
        onClick={() =>
          dispatch({ op: "insertItem", path, index: value.length, value: "" })
        }
        className="flex w-fit items-center gap-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" /> öğe
      </button>
    </div>
  );
};

interface ItemRowProps {
  parentPath: Path;
  index: number;
  child: JsonValue;
  count: number;
}

const ItemRowBase = ({ parentPath, index, child, count }: ItemRowProps) => {
  const dispatch = useKvDispatch();
  const [open, setOpen] = useState(true);
  const childPath = [...parentPath, index];
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
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{index}</span>
        {!container && (
          <div className="min-w-0 flex-1">
            <LeafInput value={child} path={childPath} />
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <TypeSwitch path={childPath} current={jsonTypeOf(child)} />
          <button
            type="button"
            disabled={index === 0}
            onClick={() => dispatch({ op: "moveItem", path: parentPath, from: index, to: index - 1 })}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Yukarı"
            aria-label="Yukarı taşı"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={index === count - 1}
            onClick={() => dispatch({ op: "moveItem", path: parentPath, from: index, to: index + 1 })}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Aşağı"
            aria-label="Aşağı taşı"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ op: "removeItem", path: parentPath, index })}
            className="text-muted-foreground hover:text-destructive"
            title="Sil"
            aria-label={`${index}. öğeyi sil`}
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

const ItemRow = memo(
  ItemRowBase,
  (p, n) =>
    p.index === n.index &&
    p.child === n.child &&
    p.count === n.count &&
    samePath(p.parentPath, n.parentPath),
);
