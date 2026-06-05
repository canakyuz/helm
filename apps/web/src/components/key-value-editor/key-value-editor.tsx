// helm — key-value editor: top-level controlled bileşen.
// Schema-less: DB'den gelen JSONB'yi doğrudan yapısal forma render eder, aynı şekli geri verir.
// İletişim sözleşmesi: dışarıya yalnızca (value, onChange). Tek doğruluk = parent state.

import { useCallback, useRef } from "react";
import { KvDispatchContext } from "./context";
import { applyOp } from "./ops";
import type { JsonValue, KvOp } from "./types";
import { ValueNode } from "./value-node";

interface KeyValueEditorProps {
  value: JsonValue | undefined;
  onChange: (next: JsonValue) => void;
}

export const KeyValueEditor = ({ value, onChange }: KeyValueEditorProps) => {
  const root: JsonValue = value === undefined ? {} : value;

  // Dispatch'i stabil tut (ref) → satır memo'su çalışır; applyOp her zaman en güncel
  // ağacı okur. Aksi halde her render yeni kapanış → tüm ağaç re-render.
  const valueRef = useRef(root);
  valueRef.current = root;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const dispatch = useCallback(
    (op: KvOp) => onChangeRef.current(applyOp(valueRef.current, op)),
    [],
  );

  return (
    <KvDispatchContext.Provider value={dispatch}>
      <div className="rounded-md border bg-card/40 p-2 text-sm">
        <ValueNode value={root} path={[]} />
      </div>
    </KvDispatchContext.Provider>
  );
};
