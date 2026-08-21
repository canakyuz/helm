import { type FormEvent, useState } from "react";
import { useLogin } from "@refinedev/core";
import { ArrowUpRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

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

  return (
    <main className="min-h-screen bg-bento-canvas text-bento-fg">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[13px] bg-bento-accent font-mono text-lg font-bold text-bento-accent-ink">h</span>
            <span className="font-heading text-lg font-semibold tracking-tight">helm</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bento-fg3">{t("Founder cockpit")}</span>
            <button type="button" onClick={() => setLocale(locale === "tr" ? "en" : "tr")} className="rounded-full border border-bento-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-bento-fg2 transition-colors hover:border-bento-fg3 hover:text-bento-fg" aria-label={locale === "tr" ? "Switch to English" : "Türkçeye geç"}>
              {locale === "tr" ? "EN" : "TR"}
            </button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-14 md:grid-cols-[1fr_420px] md:gap-20 lg:py-20">
          <section className="hidden max-w-xl md:block" aria-labelledby="welcome-title">
            <div className="mb-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-bento-fg3">
              <span className="size-2 rounded-full bg-bento-pos" aria-hidden="true" />
              {t("Control room / secure access")}
            </div>
            <h1 id="welcome-title" className="max-w-lg text-5xl font-semibold leading-[1.02] tracking-[-0.04em] lg:text-6xl">{t("Geliri tek bakışta yönet.")}</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-bento-fg2">{t("Projelerini, kaynaklarını ve günlük hareketi aynı kokpitte takip et. Helm, karar vermen gereken sayıyı öne çıkarır.")}</p>
            <div className="helm-orb-field mt-10" aria-hidden="true">
              <span className="helm-orb helm-orb-one" />
              <span className="helm-orb helm-orb-two" />
              <span className="helm-orb helm-orb-three" />
              <span className="helm-orb-grid" />
            </div>
            <div className="mt-12 flex items-center gap-8 border-t border-bento-line pt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-bento-fg3">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-bento-pos" /> {t("Private workspace")}</span>
              <span className="inline-flex items-center gap-2"><LockKeyhole className="size-4 text-bento-blue" /> {t("Supabase auth")}</span>
            </div>
          </section>

          <section className="w-full" aria-labelledby="login-title">
            <div className="rounded-[22px] bg-bento-tile p-6 ring-1 ring-bento-line sm:p-8">
              <div className="mb-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bento-fg3">{t("Secure sign in")}</p>
                <h2 id="login-title" className="mt-3 text-2xl font-semibold tracking-tight">{t("Tekrar hoş geldin.")}</h2>
                <p className="mt-2 text-sm leading-6 text-bento-fg2">{t("Kokpitine devam etmek için bilgilerini gir.")}</p>
              </div>

              <form onSubmit={submit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("E-posta")}</Label>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="can@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setValidationError(""); reset(); }} aria-invalid={Boolean(formError)} className="h-11 bg-bento-canvas px-3" required />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("Şifre")}</Label>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bento-fg3">{t("Min. 6 karakter")}</span>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setValidationError(""); reset(); }} aria-invalid={Boolean(formError)} className="h-11 bg-bento-canvas px-3 pr-11" required />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-bento-fg3 transition-colors hover:text-bento-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bento-accent" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {formError ? <p role="alert" className="text-sm text-bento-neg">{formError}</p> : null}
                <Button type="submit" disabled={isPending} className="h-11 w-full gap-2 bg-bento-accent text-bento-accent-ink hover:bg-bento-accent/85">
                  {isPending ? t("Kontrol ediliyor...") : t("Giriş yap")}
                  {!isPending ? <ArrowUpRight className="size-4" /> : null}
                </Button>
              </form>
            </div>
            <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-bento-fg3">{t("helm / private workspace")}</p>
          </section>
        </div>
      </div>
    </main>
  );
};
