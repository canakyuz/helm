// Zernio webhook imzasi: X-Zernio-Signature, HMAC-SHA256, abonelik secret'i.
// Spec imzanin ham govde uzerinde oldugunu soyluyor ama kodlamayi (hex/base64)
// ve onek ("sha256=") kullanimini yazmiyor; ikisini de kabul ediyoruz.
// Sabit zamanli karsilastirma: imza uzunlugu sizdirmasin.
// Web Crypto: Deno ve bun'da ayni.

const enc = new TextEncoder();

async function hmac(secret: string, body: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyZernioSignature(
  secret: string,
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  if (!header) return false;
  const given = header.trim().replace(/^sha256=/i, "");
  if (!given) return false;
  const mac = await hmac(secret, rawBody);
  return (
    timingSafeEqual(given.toLowerCase(), toHex(mac)) ||
    timingSafeEqual(given, toBase64(mac))
  );
}
