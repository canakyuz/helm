import { useLogin } from "@refinedev/core";
import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react";

import { CockpitVisual } from "@/components/auth/cockpit-visual";
import { type LoginCredentials } from "@/components/auth/credentials";
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
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main className="auth-page">
          <m.section className="auth-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CockpitVisual />
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
          </m.section>
        </main>
      </LazyMotion>
    </MotionConfig>
  );
}
