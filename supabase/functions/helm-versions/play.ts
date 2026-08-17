// supabase/functions/helm-versions/play.ts
// Google Play Developer API — tracks endpoint.
//   Apple eşdeğeri: appStoreVersions + TestFlight builds tek call
//   Google'da bu = "tracks" (production / internal / alpha / beta)
//
// Akış:
//   1. POST   /edits          → edit oturumu aç (id 24 saat TTL)
//   2. GET    /edits/{id}/tracks → tüm tracks + releases + versionCodes
//   3. (cleanup: edit'i delete etmeye gerek yok — sadece commit yapılmadığı sürece state'i değiştirmez)
//
// versionCode (integer string) = build_number; release.name = semver (1.2.0).

import { getPlayAccessToken } from "../_shared/play-oauth.ts";

export interface PlayVersionRow {
  project_id: string;
  source: "android";
  version: string;
  build_number: string | null;
  status: string;
  release_date: string | null;
  release_notes: string | null;
  expires_at: string | null;
  state_changed_at: string | null;
}

export interface PlayDiag {
  editStatus?: number;
  editError?: string;
  tracksStatus?: number;
  tracksError?: string;
  tracksCount?: number;
  releasesCount?: number;
  rowsCount?: number;
}

export interface PlayFetchInput {
  projectId: string;
  packageName: string;
  serviceAccountJson: string;
}

export interface PlayFetchResult {
  ok: true;
  rows: PlayVersionRow[];
  diag: PlayDiag;
}
export interface PlayFetchError {
  ok: false;
  status?: number;
  message: string;
}

// Play track release statusu → unified status enum
const mapTrackStatus = (
  track: string,
  status: string | undefined,
): string => {
  const t = track.toLowerCase();
  const s = (status ?? "").toLowerCase();
  if (s === "halted") return "rejected";
  if (s === "draft") return "ready";
  if (s === "inprogress" || s === "in_progress") return "in_review";
  if (s === "completed") {
    if (t === "production") return "live";
    return "testflight"; // internal / alpha / beta
  }
  return s || "unknown";
};

interface EditResource {
  id?: string;
  expiryTimeSeconds?: string;
}

interface ReleaseNote {
  language?: string;
  text?: string;
}
interface TrackRelease {
  name?: string; // semver-like
  versionCodes?: string[]; // integer strings
  status?: string;
  releaseNotes?: ReleaseNote[];
  userFraction?: number;
}
interface TrackResource {
  track?: string; // "production" | "internal" | "alpha" | "beta"
  releases?: TrackRelease[];
}
interface TracksResponse {
  tracks?: TrackResource[];
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

export async function fetchPlayVersions(
  input: PlayFetchInput,
): Promise<PlayFetchResult | PlayFetchError> {
  let token: string;
  try {
    token = await getPlayAccessToken(input.serviceAccountJson);
  } catch (e) {
    return {
      ok: false,
      message: `OAuth: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const diag: PlayDiag = {};
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}`;

  // 1. Edit oturumu aç
  let editId: string;
  try {
    const res = await fetchWithTimeout(`${base}/edits`, {
      method: "POST",
      headers,
      body: "{}",
    });
    diag.editStatus = res.status;
    if (!res.ok) {
      diag.editError = `${res.status}: ${(await res.text()).slice(0, 200)}`;
      return {
        ok: false,
        status: res.status,
        message: `Play edits create: ${diag.editError}`,
      };
    }
    const edit = (await res.json()) as EditResource;
    if (!edit.id) {
      return { ok: false, message: "Play edits: id is empty" };
    }
    editId = edit.id;
  } catch (e) {
    diag.editError = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Play edits exception: ${diag.editError}` };
  }

  // 2. Tracks çek
  const rows: PlayVersionRow[] = [];
  try {
    const res = await fetchWithTimeout(`${base}/edits/${editId}/tracks`, {
      headers,
    });
    diag.tracksStatus = res.status;
    if (!res.ok) {
      diag.tracksError = `${res.status}: ${(await res.text()).slice(0, 200)}`;
      return { ok: true, rows, diag };
    }
    const data = (await res.json()) as TracksResponse;
    const tracks = data.tracks ?? [];
    diag.tracksCount = tracks.length;
    let releasesCount = 0;

    for (const t of tracks) {
      if (!t.track) continue;
      for (const r of t.releases ?? []) {
        releasesCount++;
        const status = mapTrackStatus(t.track, r.status);
        const versionName = r.name || (r.versionCodes?.[0] ?? null);
        if (!versionName) continue;
        const notes =
          r.releaseNotes && r.releaseNotes.length > 0
            ? r.releaseNotes
                .map((n) => n.text)
                .filter((x): x is string => !!x)
                .join("\n---\n")
            : null;
        const codes = r.versionCodes ?? [];
        if (codes.length === 0) {
          // release var ama versionCode yok (nadir) — tek satır build_number=null
          rows.push({
            project_id: input.projectId,
            source: "android",
            version: versionName,
            build_number: null,
            status,
            release_date: null,
            release_notes: notes,
            expires_at: null,
            state_changed_at: null,
          });
          continue;
        }
        for (const code of codes) {
          rows.push({
            project_id: input.projectId,
            source: "android",
            version: versionName,
            build_number: code,
            status,
            release_date: null,
            release_notes: notes,
            expires_at: null,
            state_changed_at: null,
          });
        }
      }
    }
    diag.releasesCount = releasesCount;
    diag.rowsCount = rows.length;
  } catch (e) {
    diag.tracksError = e instanceof Error ? e.message : String(e);
  }

  return { ok: true, rows, diag };
}
