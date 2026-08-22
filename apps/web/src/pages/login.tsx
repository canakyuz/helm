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
        <GlobeVisual />
        <section className="auth-panel" aria-labelledby="auth-title">
          <header className="auth-header">
            <div className="auth-brand" role="img" aria-label={t("auth.brand.label")}>
              <img src="/helm-mark.svg" alt="" aria-hidden="true" />
              <b aria-hidden="true">helm</b>
            </div>
            <LanguageToggle />
          </header>
          <LoginForm
            hasProviderError={Boolean(error)}
            isPending={isPending}
            onClearProviderError={reset}
            onSubmit={submit}
          />
        </section>
      </section>
    </main>
  );
}
