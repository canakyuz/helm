// supabase/functions/helm-reviews/asc.ts
// App Store Connect Customer Reviews API.
// JWT _shared/asc-jwt.ts'den; 401/5xx/timeout → caller RSS fallback'e döner.

import { makeAscJwt, type ASCKeyConfig } from "../_shared/asc-jwt.ts";

export interface AscReviewRow {
  project_id: string;
  source: "appstore";
  source_method: "asc";
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

interface AscResponseAttrs {
  responseBody?: string;
  lastModifiedDate?: string;
}
interface AscReviewAttrs {
  rating?: number;
  title?: string;
  body?: string;
  reviewerNickname?: string;
  createdDate?: string;
  territory?: string;
}
interface AscReviewResource {
  id: string;
  attributes?: AscReviewAttrs;
  relationships?: { response?: { data?: { id: string } } };
}
interface AscIncluded {
  id: string;
  type: string;
  attributes?: AscResponseAttrs;
}
interface AscPage {
  data?: AscReviewResource[];
  included?: AscIncluded[];
  links?: { next?: string };
}

const TIMEOUT_MS = 10_000;

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

export interface AscFetchInput {
  projectId: string;
  appId: string;
  ascKey: ASCKeyConfig;
  sinceDate?: string | null;
}

export interface AscFetchResult {
  ok: true;
  rows: AscReviewRow[];
  pages: number;
}
export interface AscFetchError {
  ok: false;
  shouldFallback: boolean;
  status?: number;
  message: string;
}

export async function fetchAscReviews(
  input: AscFetchInput,
): Promise<AscFetchResult | AscFetchError> {
  let jwt: string;
  try {
    jwt = await makeAscJwt(input.ascKey);
  } catch (e) {
    return {
      ok: false,
      shouldFallback: true,
      message: `Could not generate a JWT: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const rows: AscReviewRow[] = [];
  let pages = 0;
  let nextUrl: string | null =
    `https://api.appstoreconnect.apple.com/v1/apps/${input.appId}/customerReviews` +
    `?limit=200&sort=-createdDate&include=response`;

  while (nextUrl && pages < 20) {
    let res: Response;
    try {
      res = await fetchWithTimeout(nextUrl, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
    } catch (e) {
      return {
        ok: false,
        shouldFallback: true,
        message: `Timeout/network: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    if (res.status === 401) {
      return {
        ok: false,
        shouldFallback: true,
        status: 401,
        message: "ASC 401 - key invalid veya Customer Reviews scope yok",
      };
    }
    if (res.status >= 500) {
      return {
        ok: false,
        shouldFallback: true,
        status: res.status,
        message: `ASC ${res.status}`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        shouldFallback: false,
        status: res.status,
        message: `ASC ${res.status}: ${await res.text()}`,
      };
    }

    const page = (await res.json()) as AscPage;
    pages++;

    const responseById = new Map<string, AscResponseAttrs>();
    for (const inc of page.included ?? []) {
      if (inc.type === "customerReviewResponses" && inc.attributes) {
        responseById.set(inc.id, inc.attributes);
      }
    }

    // sinceDate ARTIK SATIRLARI ELEMEZ, yalnizca sayfalamayi durdurur.
    //
    // Neden degisti: eskiden ilk kez gorulen "eski" yorumda dongu kirilirdi, yani
    // bir yorum bir kez kaydedildikten sonra BIR DAHA hic okunmazdi. Gelistirici
    // yaniti (developer_response) yoruma sonradan yazildigi icin o yanit
    // veritabanina asla dusmezdi - istek `include=response` ile dogru sorsa bile.
    // Ilk sayfa (200 yorum, en yeniden eskiye) zaten cekiliyor; onu tam islemenin
    // ek API maliyeti yok. Derin sayfalamaya devam etmemek icin bayrak korunur.
    let reachedSince = false;
    for (const rev of page.data ?? []) {
      const attrs = rev.attributes ?? {};
      const createdAt = attrs.createdDate ?? null;
      if (input.sinceDate && createdAt && createdAt <= input.sinceDate) {
        reachedSince = true;
      }
      const respId = rev.relationships?.response?.data?.id;
      const respAttrs = respId ? responseById.get(respId) : undefined;
      const territory = (attrs.territory ?? "").toLowerCase() || null;

      rows.push({
        project_id: input.projectId,
        source: "appstore",
        source_method: "asc",
        external_id: `asc:${territory ?? "xx"}:${rev.id}`,
        author: attrs.reviewerNickname ?? null,
        rating: typeof attrs.rating === "number" ? attrs.rating : null,
        title: attrs.title ?? null,
        body: attrs.body ?? null,
        territory,
        app_version: null,
        developer_response: respAttrs?.responseBody ?? null,
        responded_at: respAttrs?.lastModifiedDate ?? null,
        review_date: createdAt,
      });
    }

    if (reachedSince) break;
    nextUrl = page.links?.next ?? null;
  }

  return { ok: true, rows, pages };
}
