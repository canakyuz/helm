// supabase/functions/helm-versions/asc.ts
// App Store Connect API ile App Store ve TestFlight sürüm/build çekimi.
// JWT _shared/asc-jwt.ts'den. helm-reviews ile aynı integration config kullanılır.

import { makeAscJwt, type ASCKeyConfig } from "../_shared/asc-jwt.ts";

// Apple appStoreState enum (UI'de basit etiketlere mapping yapacağız)
//   READY_FOR_DISTRIBUTION | READY_FOR_SALE | PROCESSING_FOR_DISTRIBUTION
//   PREPARE_FOR_SUBMISSION | READY_FOR_REVIEW | WAITING_FOR_REVIEW
//   IN_REVIEW | PENDING_DEVELOPER_RELEASE | PENDING_APPLE_RELEASE
//   REJECTED | METADATA_REJECTED | INVALID_BINARY | DEVELOPER_REJECTED
//   REMOVED_FROM_SALE | NOT_APPLICABLE | ...
const mapAppStoreState = (raw: string | undefined): string => {
  if (!raw) return "unknown";
  if (raw === "READY_FOR_SALE" || raw === "READY_FOR_DISTRIBUTION") return "live";
  if (raw === "IN_REVIEW" || raw === "WAITING_FOR_REVIEW") return "in_review";
  if (
    raw === "PREPARE_FOR_SUBMISSION" ||
    raw === "READY_FOR_REVIEW" ||
    raw === "PENDING_DEVELOPER_RELEASE" ||
    raw === "PENDING_APPLE_RELEASE"
  ) return "ready";
  if (
    raw === "REJECTED" ||
    raw === "METADATA_REJECTED" ||
    raw === "DEVELOPER_REJECTED" ||
    raw === "INVALID_BINARY"
  ) return "rejected";
  if (raw === "REMOVED_FROM_SALE") return "removed";
  return raw.toLowerCase();
};

export interface AscVersionRow {
  project_id: string;
  source: "ios";
  version: string;
  build_number: string | null;
  status: string;
  release_date: string | null;
  release_notes: string | null;
  expires_at: string | null;
  state_changed_at: string | null;
}

const TIMEOUT_MS = 10_000;
const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

interface AscBuildAttrs {
  version?: string; // build number
  uploadedDate?: string;
  expirationDate?: string;
  processingState?: string; // PROCESSING | VALID | FAILED | INVALID
}
interface AscIncluded {
  id: string;
  type: string;
  attributes?: AscBuildAttrs & Record<string, unknown>;
}

interface AppStoreVersionAttrs {
  versionString?: string;
  appStoreState?: string;
  createdDate?: string;
  releaseNotes?: string; // genelde appStoreVersionLocalizations'ta — opsiyonel skip
}
interface AppStoreVersionResource {
  id: string;
  attributes?: AppStoreVersionAttrs;
  relationships?: { build?: { data?: { id: string } } };
}
interface AppStoreVersionsPage {
  data?: AppStoreVersionResource[];
  included?: AscIncluded[];
}

interface PreReleaseVersionAttrs {
  version?: string;
  platform?: string; // IOS | MAC_OS | TV_OS
}
interface PreReleaseVersionResource {
  id: string;
  attributes?: PreReleaseVersionAttrs;
  relationships?: { builds?: { data?: Array<{ id: string }> } };
}
interface PreReleaseVersionsPage {
  data?: PreReleaseVersionResource[];
  included?: AscIncluded[];
}

export interface AscFetchInput {
  projectId: string;
  appId: string;
  ascKey: ASCKeyConfig;
}

export interface AscFetchResult {
  ok: true;
  rows: AscVersionRow[];
}
export interface AscFetchError {
  ok: false;
  status?: number;
  message: string;
}

export async function fetchAscVersions(
  input: AscFetchInput,
): Promise<AscFetchResult | AscFetchError> {
  let jwt: string;
  try {
    jwt = await makeAscJwt(input.ascKey);
  } catch (e) {
    return { ok: false, message: `JWT: ${e instanceof Error ? e.message : String(e)}` };
  }

  const headers = { Authorization: `Bearer ${jwt}` };
  const rows: AscVersionRow[] = [];

  // 1. App Store versions (canlı + review + ready durumları)
  try {
    const url =
      `https://api.appstoreconnect.apple.com/v1/apps/${input.appId}/appStoreVersions` +
      `?limit=20&include=build`;
    const res = await fetchWithTimeout(url, { headers });
    if (res.status === 401) {
      return { ok: false, status: 401, message: "ASC 401 — Customer Reviews/Apps scope yok olabilir" };
    }
    if (res.ok) {
      const page = (await res.json()) as AppStoreVersionsPage;
      const buildById = new Map<string, AscBuildAttrs>();
      for (const inc of page.included ?? []) {
        if (inc.type === "builds" && inc.attributes) buildById.set(inc.id, inc.attributes);
      }
      for (const v of page.data ?? []) {
        const attrs = v.attributes ?? {};
        if (!attrs.versionString) continue;
        const buildId = v.relationships?.build?.data?.id;
        const build = buildId ? buildById.get(buildId) : undefined;
        rows.push({
          project_id: input.projectId,
          source: "ios",
          version: attrs.versionString,
          build_number: build?.version ?? null,
          status: mapAppStoreState(attrs.appStoreState),
          release_date: attrs.createdDate ?? null,
          release_notes: null, // localizations'tan ayrı çağrı gerekir, skip
          expires_at: build?.expirationDate ?? null,
          state_changed_at: attrs.createdDate ?? null,
        });
      }
    }
  } catch (e) {
    // Network/timeout — sessizce geç; preReleaseVersions yine denenir
    console.warn(`ASC appStoreVersions: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. Pre-release versions (TestFlight) + altlarındaki builds
  try {
    const url =
      `https://api.appstoreconnect.apple.com/v1/apps/${input.appId}/preReleaseVersions` +
      `?limit=20&include=builds`;
    const res = await fetchWithTimeout(url, { headers });
    if (res.ok) {
      const page = (await res.json()) as PreReleaseVersionsPage;
      const buildById = new Map<string, AscBuildAttrs>();
      for (const inc of page.included ?? []) {
        if (inc.type === "builds" && inc.attributes) buildById.set(inc.id, inc.attributes);
      }
      for (const v of page.data ?? []) {
        const attrs = v.attributes ?? {};
        if (!attrs.version || attrs.platform !== "IOS") continue;
        const buildIds = v.relationships?.builds?.data ?? [];
        for (const ref of buildIds) {
          const build = buildById.get(ref.id);
          if (!build?.version) continue;
          // App Store version'da zaten varsa skip (aynı build_number)
          const alreadyInStore = rows.some(
            (r) => r.version === attrs.version && r.build_number === build.version,
          );
          if (alreadyInStore) continue;
          const isExpired =
            build.expirationDate && new Date(build.expirationDate).getTime() < Date.now();
          rows.push({
            project_id: input.projectId,
            source: "ios",
            version: attrs.version,
            build_number: build.version,
            status: isExpired ? "expired" : "testflight",
            release_date: build.uploadedDate ?? null,
            release_notes: null,
            expires_at: build.expirationDate ?? null,
            state_changed_at: build.uploadedDate ?? null,
          });
        }
      }
    }
  } catch (e) {
    console.warn(`ASC preReleaseVersions: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { ok: true, rows };
}
