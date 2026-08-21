import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "tr" | "en";

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  tr: {},
  en: {
    "Ana Menü": "Main menu",
    "Ana menü": "Main menu",
    "Cockpit": "Cockpit",
    "Kullanıcılar": "Users",
    "CMS": "CMS",
    "Şemalar": "Schemas",
    "İçerikler": "Content",
    "Medya": "Media",
    "Segmentler": "Segments",
    "Yorumlar": "Reviews",
    "Müdahale geçmişi": "Intervention history",
    "Analitik & İçgörü": "Analytics & insight",
    "Gelir & Reklam": "Revenue & ads",
    "Büyüme": "Growth",
    "Huni": "Funnel",
    "Uyarılar": "Alerts",
    "Mesajlaşma": "Messaging",
    "Kampanya geçmişi": "Campaign history",
    "DevOps": "DevOps",
    "Entegrasyonlar": "Integrations",
    "Sync & Sağlık": "Sync & health",
    "Sistem": "System",
    "Loglar": "Logs",
    "Sürümler": "Versions",
    "Destek": "Support",
    "Ayarlar": "Settings",
    "Property'ler": "Properties",
    "Proje": "Project",
    "yakında": "soon",
    "Hızlı arama": "Quick search",
    "Açık mod": "Light mode",
    "Koyu mod": "Dark mode",
    "Çıkış yap": "Sign out",
    "Türkçe": "Turkish",
    "İngilizce": "English",
    "Giriş yap": "Sign in",
    "E-posta": "Email",
    "Şifre": "Password",
    "Tekrar hoş geldin.": "Welcome back.",
    "Kokpitine devam etmek için bilgilerini gir.": "Enter your details to continue to your cockpit.",
    "Geçerli bir e-posta ve en az 6 karakter şifre gir.": "Enter a valid email and a password of at least 6 characters.",
    "E-posta veya şifre hatalı. Tekrar dene.": "Incorrect email or password. Try again.",
    "Kontrol ediliyor...": "Checking...",
    "Giriş şu anda kullanılamıyor. Tekrar dene.": "Sign-in is unavailable right now. Try again.",
    "Secure sign in": "Secure sign in",
    "Founder cockpit": "Founder cockpit",
    "Control room / secure access": "Control room / secure access",
    "Private workspace": "Private workspace",
    "Supabase auth": "Supabase auth",
    "helm / private workspace": "helm / private workspace",
    "Geliri tek bakışta yönet.": "Run your revenue at a glance.",
    "Projelerini, kaynaklarını ve günlük hareketi aynı kokpitte takip et. Helm, karar vermen gereken sayıyı öne çıkarır.": "Track projects, sources, and daily movement in one cockpit. Helm surfaces the number that needs your attention.",
    "Min. 6 karakter": "Min. 6 characters",
  },
};

type I18nValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = window.localStorage.getItem("helm.locale");
    return stored === "en" || stored === "tr" ? stored : "tr";
  });
  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem("helm.locale", next);
    document.documentElement.lang = next;
  };
  const value = useMemo(() => ({ locale, setLocale, t: (key: string) => TRANSLATIONS[locale][key] ?? key }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
