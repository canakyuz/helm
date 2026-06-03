// helm — CMS `json` alanı için akıllı editör.
// Tek `bundle` alanı = tüm site en.json'u (2000+ satır). Ham textarea yerine:
// canlı doğrulama (✓/hata + konum), biçimlendir, hata kenarlığı.

import { useEffect, useRef, useState } from "react";
import { Check, AlertCircle, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const stringify = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

export const JsonField = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
}) => {
  const [text, setText] = useState(() => stringify(value));
  const [error, setError] = useState<string | null>(null);
  // Kullanıcı yazarken dış value senkronu kapalı (imleç/odak zıplamasın).
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setText(stringify(value));
  }, [value]);

  const parse = (next: string): boolean => {
    try {
      const parsed = next.trim() === "" ? {} : JSON.parse(next);
      setError(null);
      onChange(parsed);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geçersiz JSON");
      return false;
    }
  };

  const handle = (next: string) => {
    dirty.current = true;
    setText(next);
    parse(next);
  };

  const format = () => {
    try {
      const pretty = JSON.stringify(JSON.parse(text), null, 2);
      setText(pretty);
      setError(null);
      onChange(JSON.parse(pretty));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geçersiz JSON");
    }
  };

  const lines = text ? text.split("\n").length : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {error ? (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check className="size-3.5 shrink-0" />
            Geçerli JSON
            <span className="font-mono text-muted-foreground">· {lines} satır</span>
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={format}
        >
          <Braces className="size-3.5" /> Biçimlendir
        </Button>
      </div>
      <Textarea
        value={text}
        onChange={(e) => handle(e.target.value)}
        onBlur={() => (dirty.current = false)}
        spellCheck={false}
        className={`min-h-[480px] resize-y font-mono text-xs leading-relaxed ${
          error ? "border-destructive focus-visible:ring-destructive/40" : ""
        }`}
      />
    </div>
  );
};
