// helm — key-value editor: primitive yaprak editörleri + type-switch.
// string (uzun/çok satır → textarea), number, boolean, null. Hepsi `set` dispatch eder.

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useKvDispatch } from "./context";
import type { JsonType, JsonValue, Path } from "./types";

const JSON_TYPES: JsonType[] = ["string", "number", "boolean", "null", "object", "array"];
const TYPE_LABEL: Record<JsonType, string> = {
  string: "abc",
  number: "123",
  boolean: "T/F",
  null: "∅",
  object: "{}",
  array: "[]",
};

// Bir düğümün tipini değiştir (retype). Native select — yoğun ağaçta Radix yükü yok.
export const TypeSwitch = ({ path, current }: { path: Path; current: JsonType }) => {
  const dispatch = useKvDispatch();
  return (
    <select
      value={current}
      onChange={(e) => dispatch({ op: "retype", path, to: e.target.value as JsonType })}
      className="h-6 rounded border bg-background px-1 text-xs text-muted-foreground"
      title="Tipi değiştir"
      aria-label="Tipi değiştir"
    >
      {JSON_TYPES.map((t) => (
        <option key={t} value={t}>
          {TYPE_LABEL[t]}
        </option>
      ))}
    </select>
  );
};

const MULTILINE_THRESHOLD = 60;

export const LeafInput = ({ value, path }: { value: JsonValue; path: Path }) => {
  const dispatch = useKvDispatch();
  const set = (next: JsonValue) => dispatch({ op: "set", path, value: next });

  if (typeof value === "boolean") {
    return <Switch checked={value} onCheckedChange={(c) => set(c)} />;
  }

  if (typeof value === "number") {
    return (
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))}
        className="h-8"
      />
    );
  }

  if (value === null) {
    return (
      <span className="text-xs italic text-muted-foreground">null (tip değiştir →)</span>
    );
  }

  if (typeof value === "string") {
    const multiline = value.length > MULTILINE_THRESHOLD || value.includes("\n");
    if (multiline) {
      return (
        <Textarea
          value={value}
          rows={Math.min(8, value.split("\n").length + 1)}
          onChange={(e) => set(e.target.value)}
          className={cn("min-h-8 text-sm")}
        />
      );
    }
    return (
      <Input value={value} onChange={(e) => set(e.target.value)} className="h-8 text-sm" />
    );
  }

  // object/array: ValueNode container'a yönlendirir, buraya düşmez.
  return null;
};
