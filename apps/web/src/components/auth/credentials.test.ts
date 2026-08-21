import { describe, expect, test } from "bun:test";
import { validateCredentials } from "./credentials";

describe("validateCredentials", () => {
  test("normalizes email and preserves password", () => {
    const result = validateCredentials("  ADMIN@EXAMPLE.COM  ", "secret!");

    expect(result).toEqual({
      ok: true,
      value: { email: "admin@example.com", password: "secret!" },
    });
  });

  test("rejects empty and invalid emails", () => {
    expect(validateCredentials("", "secret!")).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(validateCredentials("not-an-email", "secret!")).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  test("requires at least six password characters", () => {
    expect(validateCredentials("admin@example.com", "12345")).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(validateCredentials("admin@example.com", "123456")).toEqual({
      ok: true,
      value: { email: "admin@example.com", password: "123456" },
    });
  });

  test("does not mutate raw inputs", () => {
    const email = "  ADMIN@EXAMPLE.COM  ";
    const password = "secret!";

    validateCredentials(email, password);

    expect(email).toBe("  ADMIN@EXAMPLE.COM  ");
    expect(password).toBe("secret!");
  });
});
