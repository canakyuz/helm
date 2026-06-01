import {
  type PropsWithChildren,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

/** Aktif kapsam: "all" (tüm projeler) ya da bir proje id'si. */
export type Scope = "all" | string;

interface ScopeContextValue {
  scope: Scope;
  setScope: (scope: Scope) => void;
  isAll: boolean;
}

const ScopeContext = createContext<ScopeContextValue>({} as ScopeContextValue);

/** Modül ekranları kapsamı buradan okur; switcher buradan değiştirir. */
export const useScope = () => useContext(ScopeContext);

const STORAGE_KEY = "helm-scope";

export const ScopeProvider = ({ children }: PropsWithChildren) => {
  const [scope, setScopeState] = useState<Scope>(
    () => localStorage.getItem(STORAGE_KEY) ?? "all",
  );

  const setScope = (next: Scope) => {
    setScopeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(
    () => ({ scope, setScope, isAll: scope === "all" }),
    [scope],
  );

  return (
    <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
  );
};
