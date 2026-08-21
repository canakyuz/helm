import { describe, expect, test } from "bun:test";
import { translate, type Locale } from "./messages";

const AUTH_KEYS = [
  "auth.language.label",
  "auth.language.switchToEnglish",
  "auth.language.switchToTurkish",
  "auth.brand.label",
  "auth.eyebrow",
  "auth.title",
  "auth.subtitle",
  "auth.email.label",
  "auth.email.placeholder",
  "auth.password.label",
  "auth.password.hint",
  "auth.password.show",
  "auth.password.hide",
  "auth.submit",
  "auth.submitting",
  "auth.error.validation",
  "auth.error.provider",
  "auth.security",
  "auth.visual.status",
] as const;

describe("translate", () => {
  test("resolves every auth key in both locales", () => {
    for (const locale of ["tr", "en"] as const satisfies readonly Locale[]) {
      for (const key of AUTH_KEYS) {
        expect(translate(locale, key)).not.toBe(key);
      }
    }
  });

  test("preserves the Turkish unknown-key fallback", () => {
    expect(translate("tr", "unknown")).toBe("unknown");
  });
});
