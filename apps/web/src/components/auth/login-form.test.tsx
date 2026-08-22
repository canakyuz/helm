import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ComponentProps } from "react";

import { I18nProvider } from "@/lib/i18n";
import { LoginForm } from "./login-form";

GlobalRegistrator.register();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

afterAll(() => GlobalRegistrator.unregister());

function renderForm(overrides: Partial<ComponentProps<typeof LoginForm>> = {}) {
  const props: ComponentProps<typeof LoginForm> = {
    hasProviderError: false,
    isPending: false,
    onClearProviderError: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  };

  return render(<I18nProvider><LoginForm {...props} /></I18nProvider>);
}

describe("LoginForm", () => {
  test("disables submission while pending", () => {
    renderForm({ isPending: true });

    const submit = screen.getByRole("button", { name: "Kontrol ediliyor…" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  test("shows a generic provider error and clears it on edit", () => {
    const clearProviderError = mock(() => undefined);
    renderForm({ hasProviderError: true, onClearProviderError: clearProviderError });

    expect(screen.getByRole("alert").textContent).toBe("E-posta veya şifre hatalı. Tekrar dene.");
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "user@example.com" } });
    expect(clearProviderError).toHaveBeenCalledTimes(1);
  });

  test("normalizes valid credentials before submission", () => {
    const submit = mock(() => undefined);
    renderForm({ onSubmit: submit });

    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "  USER@EXAMPLE.COM  " } });
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "secret!" } });
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(submit).toHaveBeenCalledWith({ email: "user@example.com", password: "secret!" });
  });

  test("clears a validation error when the user edits a field", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "user@example.com" } });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("renders the stored English locale", () => {
    window.localStorage.setItem("helm.locale", "en");
    renderForm();

    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
});
