// helm — key-value editor: runtime tipe göre dispatcher + collapse toggle.
// Recursive çekirdek: object/array → ilgili container, primitive → leaf.

import { ChevronDown, ChevronRight } from "lucide-react";
import { ArrayNode } from "./array-node";
import { LeafInput } from "./leaf-node";
import { ObjectNode } from "./object-node";
import { isObject } from "./ops";
import type { JsonValue, Path } from "./types";

export const ValueNode = ({ value, path }: { value: JsonValue; path: Path }) => {
  if (isObject(value)) return <ObjectNode value={value} path={path} />;
  if (Array.isArray(value)) return <ArrayNode value={value} path={path} />;
  return <LeafInput value={value} path={path} />;
};

export const CollapseToggle = ({
  open,
  onToggle,
  summary,
}: {
  open: boolean;
  onToggle: () => void;
  summary: string;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex shrink-0 items-center gap-0.5 text-muted-foreground hover:text-foreground"
    aria-expanded={open}
  >
    {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
    <span className="text-[10px] tabular-nums">{summary}</span>
  </button>
);
