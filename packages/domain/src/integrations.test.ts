import { describe, expect, it } from "bun:test";
import { PROVIDERS, PROVIDER_FIELDS, PROVIDER_LABEL, isSecretKey, providerLabel } from "./integrations";

// Saglayici listesi DB check constraint'i ile birebir olmali (0051). Eksik
// kayit ekranda ham kimlik olarak cikar - bu dosyanin basindaki olay.
describe("zernio saglayicisi", () => {
  it("PROVIDERS listesinde ve etiketi var", () => {
    expect(PROVIDERS).toContain("zernio");
    expect(PROVIDER_LABEL.zernio).toBe("Zernio");
    expect(providerLabel("zernio")).toBe("Zernio");
  });

  it("api_key sir, profile_id istege bagli", () => {
    const keys = PROVIDER_FIELDS.zernio.map((f) => f.key);
    expect(keys).toEqual(["api_key", "profile_id"]);
    expect(isSecretKey("zernio", "api_key")).toBe(true);
    expect(isSecretKey("zernio", "profile_id")).toBe(false);
    expect(PROVIDER_FIELDS.zernio.find((f) => f.key === "profile_id")?.optional).toBe(true);
  });
});
