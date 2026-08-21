import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Locale } from "@/lib/i18n/messages";

export type { Locale } from "@/lib/i18n/messages";

type I18nValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "tr";

  try {
    const stored = window.localStorage.getItem("helm.locale");
    return stored === "en" || stored === "tr" ? stored : "tr";
  } catch {
    return "tr";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    window.localStorage.setItem("helm.locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t: (key: string) => translate(locale, key) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
