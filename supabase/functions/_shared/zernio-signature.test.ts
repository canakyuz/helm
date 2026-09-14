import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyZernioSignature } from "./zernio-signature";

const secret = "whsec_test_123";
const body = JSON.stringify({ id: "evt_1", event: "webhook.test", data: {} });
const hex = createHmac("sha256", secret).update(body).digest("hex");
const b64 = createHmac("sha256", secret).update(body).digest("base64");

describe("verifyZernioSignature", () => {
  it("hex imzayi kabul eder (duz ve sha256= onekli)", async () => {
    expect(await verifyZernioSignature(secret, body, hex)).toBe(true);
    expect(await verifyZernioSignature(secret, body, `sha256=${hex}`)).toBe(true);
  });
  it("base64 imzayi kabul eder", async () => {
    expect(await verifyZernioSignature(secret, body, b64)).toBe(true);
  });
  it("yanlis secret, degismis govde ve eksik header reddedilir", async () => {
    expect(await verifyZernioSignature("baska", body, hex)).toBe(false);
    expect(await verifyZernioSignature(secret, body + " ", hex)).toBe(false);
    expect(await verifyZernioSignature(secret, body, null)).toBe(false);
    expect(await verifyZernioSignature(secret, body, "")).toBe(false);
  });
});
