// helm — key-value editor dispatch context.
// Dispatch ref tabanlı stabil tutulur → satır memo'su çalışır (yeni op her render'da
// kapanış oluşturmaz). Yapraklar parent'ını bilmez, sadece kendi path'ini bilir.

import { createContext, useContext } from "react";
import type { KvOp, Path } from "./types";

export type KvDispatch = (op: KvOp) => void;

export const KvDispatchContext = createContext<KvDispatch>(() => {
  throw new Error("useKvDispatch must be used within <KeyValueEditor>");
});

export const useKvDispatch = (): KvDispatch => useContext(KvDispatchContext);

// Path referans kimliği her render'da değişir; memo için eleman-bazlı eşitlik.
export const samePath = (a: Path, b: Path): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);
