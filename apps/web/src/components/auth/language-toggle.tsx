import { useI18n } from "@/lib/i18n";

const LOCALES = ["tr", "en"] as const;

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="auth-language" role="group" aria-label={t("auth.language.label")}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          aria-label={t(option === "tr" ? "auth.language.switchToTurkish" : "auth.language.switchToEnglish")}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
