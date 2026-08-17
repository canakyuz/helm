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

interface BuildResource {
  id: string;
  attributes?: AscBuildAttrs;
  relationships?: { preReleaseVersion?: { data?: { id: string } } };
}
interface PreReleaseIncluded {
  id: string;
  type: string;
  attributes?: PreReleaseVersionAttrs;
}
interface BuildsPage {
  data?: BuildResource[];
  included?: PreReleaseIncluded[];
}

export interface AscFetchInput {
  projectId: string;
  appId: string;
  ascKey: ASCKeyConfig;
}

export interface AscDiag {
  appStoreVersionsStatus?: number;
  appStoreVersionsCount?: number;
  appStoreVersionsError?: string;
  preReleaseStatus?: number;
  preReleaseCount?: number;
  preReleaseError?: string;
}

export interface AscFetchResult {
  ok: true;
  rows: AscVersionRow[];
  diag: AscDiag;
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
  const diag: AscDiag = {};

  // 1. App Store versions (canlı + review + ready durumları)
  try {
    const url =
      `https://api.appstoreconnect.apple.com/v1/apps/${input.appId}/appStoreVersions` +
      `?limit=20&include=build`;
    const res = await fetchWithTimeout(url, { headers });
    diag.appStoreVersionsStatus = res.status;
    if (res.status === 401) {
      return { ok: false, status: 401, message: "ASC 401 — App Manager/Admin scope required (for appStoreVersions)" };
    }
    if (!res.ok) {
      diag.appStoreVersionsError = `${res.status}: ${(await res.text()).slice(0, 200)}`;
    } else {
      const page = (await res.json()) as AppStoreVersionsPage;
      const buildById = new Map<string, AscBuildAttrs>();
      for (const inc of page.included ?? []) {
        if (inc.type === "builds" && inc.attributes) buildById.set(inc.id, inc.attributes);
      }
      let count = 0;
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
          release_notes: null,
          expires_at: build?.expirationDate ?? null,
          state_changed_at: attrs.createdDate ?? null,
        });
        count++;
      }
      diag.appStoreVersionsCount = count;
    }
  } catch (e) {
    diag.appStoreVersionsError = e instanceof Error ? e.message : String(e);
  }

  // 2. Builds (TestFlight) — top-level /v1/builds?filter[app]=...&include=preReleaseVersion
  //    Relationship endpoint /v1/apps/{id}/preReleaseVersions ?include= parametresini
  //    reddediyor (PARAMETER_ERROR.ILLEGAL); top-level collection ile filter + include
  //    tek call'da build + parent version verir.
  try {
    const url =
      `https://api.appstoreconnect.apple.com/v1/builds` +
      `?filter[app]=${input.appId}&include=preReleaseVersion&limit=50&sort=-uploadedDate`;
    const res = await fetchWithTimeout(url, { headers });
    diag.preReleaseStatus = res.status;
    if (!res.ok) {
      diag.preReleaseError = `${res.status}: ${(await res.text()).slice(0, 200)}`;
    } else {
      const page = (await res.json()) as BuildsPage;
      const preReleaseById = new Map<string, PreReleaseVersionAttrs>();
      for (const inc of page.included ?? []) {
        if (inc.type === "preReleaseVersions" && inc.attributes) {
          preReleaseById.set(inc.id, inc.attributes);
        }
      }
      let count = 0;
      for (const b of page.data ?? []) {
        const build = b.attributes ?? {};
        if (!build.version) continue;
        const prvId = b.relationships?.preReleaseVersion?.data?.id;
        const prv = prvId ? preReleaseById.get(prvId) : undefined;
        const semver = prv?.version;
        if (!semver || prv?.platform !== "IOS") continue;
        const alreadyInStore = rows.some(
          (r) => r.version === semver && r.build_number === build.version,
        );
        if (alreadyInStore) continue;
        const isExpired =
          build.expirationDate && new Date(build.expirationDate).getTime() < Date.now();
        rows.push({
          project_id: input.projectId,
          source: "ios",
          version: semver,
          build_number: build.version,
          status: isExpired ? "expired" : "testflight",
          release_date: build.uploadedDate ?? null,
          release_notes: null,
          expires_at: build.expirationDate ?? null,
          state_changed_at: build.uploadedDate ?? null,
        });
        count++;
      }
      diag.preReleaseCount = count;
    }
  } catch (e) {
    diag.preReleaseError = e instanceof Error ? e.message : String(e);
  }

  return { ok: true, rows, diag };
}
