export interface LoginCredentials {
  email: string;
  password: string;
}

export type CredentialResult =
  | { ok: true; value: LoginCredentials }
  | { ok: false; reason: "invalid_credentials" };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 6;

export function validateCredentials(email: string, password: string): CredentialResult {
  const normalizedEmail = email.trim().toLowerCase();
  const isValidEmail = EMAIL_PATTERN.test(normalizedEmail);

  if (!isValidEmail || password.length < MINIMUM_PASSWORD_LENGTH) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return { ok: true, value: { email: normalizedEmail, password } };
}
