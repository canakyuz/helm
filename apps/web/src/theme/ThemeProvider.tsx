import {
  type PropsWithChildren,
  createContext,
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
} from "./presets";

interface HelmThemeContextValue {
  theme: HelmTheme;
  themeKey: string;
  setThemeKey: (key: string) => void;
  themes: HelmTheme[];
}

const HelmThemeContext = createContext<HelmThemeContextValue>(
  {} as HelmThemeContextValue,
);

/** Aktif temayı ve seçiciyi verir. Grafikler bunu palet için kullanır. */
export const useHelmTheme = () => useContext(HelmThemeContext);

const STORAGE_KEY = "helm-theme";

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [themeKey, setThemeKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_KEY,
  );

  const theme = useMemo(() => getTheme(themeKey), [themeKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeKey);
    const root = document.documentElement;
    // CSS token katmanı [data-helm-theme] ile hedeflenir.
    root.dataset.helmTheme = themeKey;
    // shadcn bileşenlerinin dark: varyantları için .dark sınıfı.
    root.classList.toggle("dark", theme.isDark);
  }, [themeKey, theme.isDark]);

  const value = useMemo(
    () => ({ theme, themeKey, setThemeKey, themes: HELM_THEMES }),
    [theme, themeKey],
  );

  return (
    <HelmThemeContext.Provider value={value}>
      {children}
    </HelmThemeContext.Provider>
  );
};
