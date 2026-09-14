// Zernio API istemcisi - tek giris noktasi. Key'i alir, hatayi Zernio'nun
// {error,type,code} govdesinden okur. Loglara key yazilmaz.

export const ZERNIO_BASE = "https://zernio.com/api/v1";

interface ZernioErrorBody {
  error?: string;
  type?: string;
  code?: string;
}

export class ZernioApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export async function zernioFetch<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.ok) return (await res.json()) as T;
  const text = await res.text();
  let parsed: ZernioErrorBody | null = null;
  try {
    parsed = JSON.parse(text) as ZernioErrorBody;
  } catch {
    // duz metin hata
  }
  const retryAfter = Number(res.headers.get("retry-after")) || undefined;
  throw new ZernioApiError(
    res.status,
    parsed?.code,
    `Zernio ${res.status}: ${parsed?.error ?? text.slice(0, 200)}`,
    retryAfter,
  );
}

export interface ZernioProfile {
  _id: string;
  name: string;
  isDefault?: boolean;
}

export interface ZernioAccount {
  _id: string;
  platform: string;
  /** Spec'te tip belirsiz: duz id ya da populate edilmis {_id}. */
  profileId?: string | { _id: string } | null;
  username?: string | null;
  displayName?: string | null;
  profilePicture?: string | null;
  profileUrl?: string | null;
  isActive?: boolean;
  needsReconnection?: boolean;
  /** Yalnizca analytics eklentisiyle gelir. */
  followersCount?: number | null;
  enabled?: boolean;
}

export interface ZernioPostAnalytics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  views?: number;
}

export interface ZernioAnalyticsPost {
  _id: string;
  status: string;
  publishedAt: string | null;
  analytics?: ZernioPostAnalytics | null;
  platformAnalytics?: Array<{
    platform: string;
    accountId: string;
    analytics?: ZernioPostAnalytics | null;
  }>;
}

export function profileIdOf(account: ZernioAccount): string | null {
  const p = account.profileId;
  if (!p) return null;
  return typeof p === "string" ? p : p._id;
}

/** config.profile_id bossa isDefault profil, o da yoksa ilk profil. */
export async function resolveProfileId(
  apiKey: string,
  configured?: string,
): Promise<string> {
  if (configured && configured.trim()) return configured.trim();
  const { profiles } = await zernioFetch<{ profiles: ZernioProfile[] }>(
    apiKey,
    "/profiles",
  );
  const chosen = profiles.find((p) => p.isDefault) ?? profiles[0];
  if (!chosen) throw new Error("Zernio: hesapta hic profil yok");
  return chosen._id;
}

export async function listAccounts(
  apiKey: string,
  profileId: string,
): Promise<ZernioAccount[]> {
  const { accounts } = await zernioFetch<{ accounts: ZernioAccount[] }>(
    apiKey,
    "/accounts",
  );
  return accounts.filter((a) => profileIdOf(a) === profileId);
}

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

/** Post analitigi - sayfalari sonuna kadar gezer. O(P) istek sayisi P/50. */
export async function listAnalyticsPosts(
  apiKey: string,
  profileId: string,
  fromDate: string,
  toDate: string,
): Promise<ZernioAnalyticsPost[]> {
  const out: ZernioAnalyticsPost[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      profileId,
      fromDate,
      toDate,
      limit: String(PAGE_SIZE),
      page: String(page),
    });
    const { posts } = await zernioFetch<{ posts?: ZernioAnalyticsPost[] }>(
      apiKey,
      `/analytics?${qs.toString()}`,
    );
    const batch = posts ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}
