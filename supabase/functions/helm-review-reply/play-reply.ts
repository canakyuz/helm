// supabase/functions/helm-review-reply/play-reply.ts
// Google Play androidpublisher.reviews.reply — idempotent (üzerine yazar).

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as ServiceAccount;
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signingInput =
    b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(claim));

  const pem = sa.private_key.replace(/\\n/g, "\n");
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${signingInput}.${sigB64}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(sa.client_email, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

export interface PlayReplyInput {
  serviceAccountJson: string;
  packageName: string;
  reviewId: string;
  body: string;
}

export interface PlayReplySuccess {
  ok: true;
  respondedAt: string;
}
export interface PlayReplyError {
  ok: false;
  status: number;
  message: string;
}

export async function sendPlayReply(
  input: PlayReplyInput,
): Promise<PlayReplySuccess | PlayReplyError> {
  let token: string;
  try {
    token = await getAccessToken(input.serviceAccountJson);
  } catch (e) {
    return { ok: false, status: 500, message: e instanceof Error ? e.message : String(e) };
  }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/reviews/${input.reviewId}:reply`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyText: input.body }),
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: `Play reply ${res.status}: ${await res.text()}`,
    };
  }
  return { ok: true, respondedAt: new Date().toISOString() };
}
