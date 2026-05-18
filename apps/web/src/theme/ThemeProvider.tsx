import { ConfigProvider } from "antd";
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeKey);
    // CSS katmanı temayı body[data-helm-theme] üzerinden hedefler.
    document.body.dataset.helmTheme = themeKey;
  }, [themeKey]);

  const theme = useMemo(() => getTheme(themeKey), [themeKey]);

  const value = useMemo(
    () => ({ theme, themeKey, setThemeKey, themes: HELM_THEMES }),
    [theme, themeKey],
  );

  return (
    <HelmThemeContext.Provider value={value}>
      <ConfigProvider theme={theme.config}>{children}</ConfigProvider>
    </HelmThemeContext.Provider>
  );
};
