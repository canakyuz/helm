import { useLogin } from "@refinedev/core";

import { type LoginCredentials } from "@/components/auth/credentials";
import { GlobeVisual } from "@/components/auth/globe-visual";
import { LanguageToggle } from "@/components/auth/language-toggle";
import { LoginForm } from "@/components/auth/login-form";
import { useI18n } from "@/lib/i18n";
import "@/styles/auth.css";

export function LoginPage() {
  const { mutate: login, isPending, error, reset } = useLogin();
  const { t } = useI18n();
  const submit = (credentials: LoginCredentials) => {
    reset();
    login(credentials);
  };

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <section className="auth-stack" aria-label={t("auth.brand.label")}>
          <header className="auth-header auth-tile">
            <div className="auth-brand" role="img" aria-label={t("auth.brand.label")}>
              <img src="/helm-mark.svg" alt="" aria-hidden="true" />
              <b aria-hidden="true">helm</b>
            </div>
            <LanguageToggle />
          </header>
          <section className="auth-panel auth-tile" aria-labelledby="auth-title">
            <LoginForm
              hasProviderError={Boolean(error)}
              isPending={isPending}
              onClearProviderError={reset}
              onSubmit={submit}
            />
          </section>
          <footer className="auth-security auth-tile">
            <span aria-hidden="true" />
            <p>{t("auth.security")}</p>
          </footer>
        </section>
        <GlobeVisual />
      </section>
    </main>
  );
}
