import { type FormEvent, useState } from "react";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";

import { validateCredentials, type LoginCredentials } from "@/components/auth/credentials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

interface LoginFormProps {
  hasProviderError: boolean;
  isPending: boolean;
  onClearProviderError: () => void;
  onSubmit: (credentials: LoginCredentials) => void;
}

export function LoginForm({
  hasProviderError,
  isPending,
  onClearProviderError,
  onSubmit,
}: LoginFormProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const errorMessage = validationError
    ? t("auth.error.validation")
    : hasProviderError
      ? t("auth.error.provider")
      : "";

  const clearErrors = () => {
    setValidationError(false);
    if (hasProviderError) onClearProviderError();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const result = validateCredentials(email, password);
    if (!result.ok) {
      setValidationError(true);
      return;
    }

    setValidationError(false);
    onSubmit(result.value);
  };

  return (
    <div className="auth-form-wrap">
      <div className="auth-form-heading">
        <p className="auth-eyebrow">{t("auth.eyebrow")}</p>
        <h1 id="auth-title">{t("auth.title")}</h1>
        <p>{t("auth.subtitle")}</p>
      </div>

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <div className="auth-field">
          <Label htmlFor="auth-email">{t("auth.email.label")}</Label>
          <Input
            id="auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder={t("auth.email.placeholder")}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearErrors();
            }}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? "auth-form-error" : undefined}
          />
        </div>

        <div className="auth-field">
          <div className="auth-field-label-row">
            <Label htmlFor="auth-password">{t("auth.password.label")}</Label>
            <span>{t("auth.password.hint")}</span>
          </div>
          <div className="auth-password-field">
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearErrors();
              }}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "auth-form-error" : undefined}
            />
            <button
              className="auth-password-toggle"
              type="button"
              aria-label={t(showPassword ? "auth.password.hide" : "auth.password.show")}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        </div>

        {errorMessage ? <p id="auth-form-error" className="auth-form-error" role="alert">{errorMessage}</p> : null}

        <Button className="auth-submit" type="submit" disabled={isPending}>
          {isPending ? t("auth.submitting") : t("auth.submit")}
          {!isPending ? <ArrowUpRight aria-hidden="true" /> : null}
        </Button>
      </form>

    </div>
  );
}
