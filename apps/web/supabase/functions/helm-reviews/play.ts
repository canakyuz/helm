// supabase/functions/helm-reviews/play.ts
// Google Play Developer Reviews API.
// API SADECE son 7 günü döner — cron 30dk ile kayıp olmaz.

export interface PlayReviewRow {
  project_id: string;
  source: "playstore";
  source_method: "play";
  external_id: string;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory: string | null;
  app_version: string | null;
  developer_response: string | null;
  responded_at: string | null;
  review_date: string | null;
}

export interface PlayFetchInput {
  projectId: string;
  packageName: string;
  serviceAccountJson: string;
  languageCodes: string[];
}

interface PlayReviewApi {
  reviewId: string;
  authorName?: string;
  comments?: Array<{
    userComment?: {
      text?: string;
      lastModified?: { seconds?: string };
      starRating?: number;
      reviewerLanguage?: string;
      appVersionName?: string;
    };
    developerComment?: {
      text?: string;
      lastModified?: { seconds?: string };
    };
  }>;
}

interface PlayPage {
  reviews?: PlayReviewApi[];
  tokenPagination?: { nextPageToken?: string };
}

// In-memory access token cache. Edge Function instance lifetime'ı boyunca yaşar.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  const cacheKey = sa.client_email;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

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

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google OAuth ${tokenRes.status}: ${await tokenRes.text()}`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache.set(cacheKey, {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  });
  return tokenData.access_token;
}

export async function fetchPlayReviews(
  input: PlayFetchInput,
): Promise<{ rows: PlayReviewRow[]; pages: number } | { error: string }> {
  let token: string;
  try {
    token = await getAccessToken(input.serviceAccountJson);
  } catch (e) {
    return { error: `OAuth: ${e instanceof Error ? e.message : String(e)}` };
  }

  const rows: PlayReviewRow[] = [];
  let pages = 0;

  for (const lang of input.languageCodes) {
    let pageToken: string | undefined;
    do {
      const url = new URL(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/reviews`,
      );
      url.searchParams.set("maxResults", "100");
      url.searchParams.set("translationLanguage", lang);
      if (pageToken) url.searchParams.set("token", pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { error: `Play ${res.status}: ${await res.text()}` };
      }
      const page = (await res.json()) as PlayPage;
      pages++;

      for (const rev of page.reviews ?? []) {
        const userComment = rev.comments?.[0]?.userComment;
        const devComment = rev.comments?.[0]?.developerComment;
        if (!userComment) continue;
        const reviewSeconds = Number(userComment.lastModified?.seconds ?? 0);
        const respSeconds = Number(devComment?.lastModified?.seconds ?? 0);
        rows.push({
          project_id: input.projectId,
          source: "playstore",
          source_method: "play",
          external_id: `play:${userComment.reviewerLanguage ?? lang}:${rev.reviewId}`,
          author: rev.authorName ?? null,
          rating: userComment.starRating ?? null,
          title: null,
          body: userComment.text ?? null,
          territory: userComment.reviewerLanguage ?? lang,
          app_version: userComment.appVersionName ?? null,
          developer_response: devComment?.text ?? null,
          responded_at: respSeconds ? new Date(respSeconds * 1000).toISOString() : null,
          review_date: reviewSeconds ? new Date(reviewSeconds * 1000).toISOString() : null,
        });
      }

      pageToken = page.tokenPagination?.nextPageToken;
    } while (pageToken && pages < 20);
  }

  return { rows, pages };
}
