import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_THEME_KEY,
  HELM_THEMES,
  type HelmTheme,
  getTheme,
  otherKey,
} from "./presets";

interface HelmThemeContextValue {
  theme: HelmTheme;
  themeKey: string;
  setThemeKey: (key: string) => void;
  toggleMode: () => void;
  themes: HelmTheme[];
}

const HelmThemeContext = createContext<HelmThemeContextValue>(
  {} as HelmThemeContextValue,
);

/** Aktif temayı ve seçiciyi verir. Grafikler bunu palet için kullanır. */
export const useHelmTheme = () => useContext(HelmThemeContext);

const STORAGE_KEY = "helm-mode";
const LEGACY_STORAGE_KEY = "helm-theme";

/** localStorage'dan başlangıç tema key'i - eski "helm-theme" varsa migrate. */
const readInitialKey = (): string => {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current === "glass-dark" || current === "glass-light") return current;

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      // Eski "helm-light" → light, geri kalan tüm dark temalar → dark.
      const migrated = legacy === "helm-light" ? "glass-light" : "glass-dark";
      localStorage.setItem(STORAGE_KEY, migrated);
      return migrated;
    }
  } catch {
    // SSR / private mode - sessizce default'a düş.
  }
  return DEFAULT_THEME_KEY;
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [themeKey, setThemeKey] = useState<string>(readInitialKey);

  const theme = useMemo(() => getTheme(themeKey), [themeKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeKey);
    const root = document.documentElement;
    // CSS token katmanı [data-helm-theme] ile hedeflenir.
    root.dataset.helmTheme = themeKey;
    // shadcn bileşenlerinin dark: varyantları için .dark sınıfı.
    root.classList.toggle("dark", theme.mode === "dark");
  }, [themeKey, theme.mode]);

  const toggleMode = useCallback(() => {
    setThemeKey((k) => otherKey(k));
  }, []);

  const value = useMemo(
    () => ({ theme, themeKey, setThemeKey, toggleMode, themes: HELM_THEMES }),
    [theme, themeKey, toggleMode],
  );

  return (
    <HelmThemeContext.Provider value={value}>
      {children}
    </HelmThemeContext.Provider>
  );
};
