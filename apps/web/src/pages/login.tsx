import { type FormEvent, useState } from "react";
import { useLogin } from "@refinedev/core";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export const LoginPage = () => {
  const { locale, setLocale, t } = useI18n();
  const { mutate: login, isPending, error, reset } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 6) {
      setValidationError(t("Geçerli bir e-posta ve en az 6 karakter şifre gir."));
      return;
    }
    setValidationError("");
    reset();
    login({ email: normalizedEmail, password });
  };

  const formError = validationError || (error ? t("E-posta veya şifre hatalı. Tekrar dene.") : "");
  const clearError = () => { setValidationError(""); reset(); };

  return (
    <main className="helm-login-shell">
      <div className="helm-login-grid" aria-hidden="true" />
      <header className="helm-login-header">
        <a href="/login" className="helm-login-brand" aria-label="Helm login">
          <span className="helm-login-mark">h</span>
          <span>helm</span>
        </a>
        <div className="helm-login-header-meta">
          <span>{t("Kurucu kokpiti")}</span>
          <button type="button" onClick={() => setLocale(locale === "tr" ? "en" : "tr")} aria-label={locale === "tr" ? "Switch to English" : "Türkçeye geç"}>
            {locale === "tr" ? "EN" : "TR"}
          </button>
        </div>
      </header>

      <div className="helm-login-layout">
        <section className="helm-login-copy" aria-labelledby="welcome-title">
          <p className="helm-login-kicker"><span /> {t("Kontrol odası / güvenli erişim")}</p>
          <h1 id="welcome-title">{t("Geliri tek bakışta yönet.")}</h1>
          <p className="helm-login-lede">{t("Projelerini, kaynaklarını ve günlük hareketi aynı kokpitte takip et. Helm, karar vermen gereken sayıyı öne çıkarır.")}</p>
          <div className="helm-login-facts">
            <span><b>01</b> Live revenue</span>
            <span><b>02</b> One cockpit</span>
            <span><b>03</b> Clear action</span>
          </div>
        </section>

        <section className="helm-orbit-stage" aria-label="Helm data orbit visualization">
          <div className="helm-login-photo" role="img" aria-label="Analytics workspace" />
          <div className="helm-orbit-glow" />
          <div className="helm-orbit orbit-one"><i /></div>
          <div className="helm-orbit orbit-two"><i /></div>
          <div className="helm-orbit orbit-three"><i /></div>
          <div className="helm-orbit-core"><span>H</span><small>LIVE</small></div>
          <div className="helm-orbit-label orbit-label-a">REVENUE <b>+18.4%</b></div>
          <div className="helm-orbit-label orbit-label-b">PROJECTS <b>04</b></div>
          <div className="helm-orbit-caption">{t("Özel çalışma alanı")}</div>
        </section>

        <section className="helm-login-panel" aria-labelledby="login-title">
          <div className="helm-login-panel-head">
            <p>{t("Güvenli giriş")}</p>
            <span>01 / 01</span>
          </div>
          <h2 id="login-title">{t("Tekrar hoş geldin.")}</h2>
          <p className="helm-login-panel-subtitle">{t("Kokpitine devam etmek için bilgilerini gir.")}</p>

          <form onSubmit={submit} className="helm-login-form" noValidate>
            <div className="helm-field">
              <Label htmlFor="email">{t("E-posta")}</Label>
              <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="can@example.com" value={email} onChange={(event) => { setEmail(event.target.value); clearError(); }} aria-invalid={Boolean(formError)} required />
            </div>
            <div className="helm-field">
              <div className="helm-field-label-row"><Label htmlFor="password">{t("Şifre")}</Label><span>{t("Min. 6 karakter")}</span></div>
              <div className="helm-password-field">
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); clearError(); }} aria-invalid={Boolean(formError)} required />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>{showPassword ? <EyeOff /> : <Eye />}</button>
              </div>
            </div>
            {formError ? <p className="helm-login-error" role="alert">{formError}</p> : null}
            <Button type="submit" disabled={isPending} className="helm-login-submit">
              {isPending ? t("Kontrol ediliyor...") : t("Giriş yap")}
              {!isPending ? <ArrowUpRight /> : null}
            </Button>
          </form>
          <p className="helm-login-panel-footer">{t("helm / özel çalışma alanı")}</p>
        </section>
      </div>
    </main>
  );
};
