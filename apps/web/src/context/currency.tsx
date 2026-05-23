import {
  type PropsWithChildren,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

interface DisplayCurrencyValue {
  currency: string;
  setCurrency: (c: string) => void;
}

const Ctx = createContext<DisplayCurrencyValue>({} as DisplayCurrencyValue);

export const useDisplayCurrency = () => useContext(Ctx);

const STORAGE_KEY = "helm-currency";

export const DisplayCurrencyProvider = ({ children }: PropsWithChildren) => {
  const [currency, setCurrencyState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? "USD",
  );

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    localStorage.setItem(STORAGE_KEY, c);
  };

  const value = useMemo(() => ({ currency, setCurrency }), [currency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
