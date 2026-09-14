import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

// Sosyal yayin katmani (Zernio alt proje 2). Okuma social_library /
// social_posts tablolarindan (authenticated SELECT); YAZMA yalnizca security
// definer RPC'ler uzerinden. Zernio anahtari istemciye hic inmez: RPC istegi
// pg_net ile veritabani atar (spec 2026-09-14-zernio-sp2-publishing-design).

export type SocialPlatform = "tiktok" | "instagram";

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = ["tiktok", "instagram"];

export type SocialPostStatus =
  | "sending"
  | "scheduled"
  | "publishing"
  | "published"
  | "partial"
  | "failed"
  | "cancelled";

export interface SocialLibraryItem {
  id: string;
  project_id: string;
  campaign: string;
  code: string;
  sort_order: number;
  hook: string;
  voice: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  tiktok_caption: string;
  instagram_caption: string;
  pinned_comment: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialPostPlatform {
  platform: SocialPlatform;
  account_id: string;
  /** Zernio'nun platform bazli durumu - serbest metin, istemci yorumlar. */
  status: string;
  url: string | null;
  error: string | null;
}

export interface SocialPost {
  id: string;
  project_id: string;
  library_id: string | null;
  zernio_post_id: string | null;
  status: SocialPostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  platforms: SocialPostPlatform[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

const LIBRARY_COLUMNS =
  "id, project_id, campaign, code, sort_order, hook, voice, video_url, thumbnail_url, duration_sec, tiktok_caption, instagram_caption, pinned_comment, archived, created_at, updated_at";

const POST_COLUMNS =
  "id, project_id, library_id, zernio_post_id, status, scheduled_for, published_at, platforms, error, created_at, updated_at";

/** PostgREST numeric'i string dondurebilir; bos/bozuk deger null olur. */
const toNumberOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * RPC hatasi PostgREST nesnesi olarak gelir; Turkce `message` kullaniciya
 * gosterilecek metin. Error'a sariyoruz ki mutation onError tipi tutarli olsun.
 */
const rpcError = (error: { message: string }): Error => new Error(error.message);

export async function fetchSocialLibrary(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<SocialLibraryItem[]> {
  let q = client
    .from("social_library")
    .select(LIBRARY_COLUMNS)
    .eq("archived", false)
    .order("sort_order");
  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  const { data, error } = await q;
  if (error) throw error;
  // Time: O(n). Tek alan donusumu; geri kalan satir oldugu gibi.
  return ((data ?? []) as Array<Omit<SocialLibraryItem, "duration_sec"> & { duration_sec: unknown }>).map(
    (r) => ({ ...r, duration_sec: toNumberOrNull(r.duration_sec) }),
  );
}

export async function fetchSocialPosts(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<SocialPost[]> {
  let q = client
    .from("social_posts")
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as SocialPost[]).map((p) => ({
    ...p,
    platforms: Array.isArray(p.platforms) ? p.platforms : [],
  }));
}

/** `scheduledFor` null = "simdi paylas" (sunucu +2 dk'ya planlar). Doner: post id. */
export async function publishSocialItem(
  client: SupabaseClient,
  args: { libraryId: string; platforms: SocialPlatform[]; scheduledFor: string | null },
): Promise<string> {
  const { data, error } = await client.rpc("helm_social_publish", {
    p_library_id: args.libraryId,
    p_platforms: args.platforms,
    p_scheduled_for: args.scheduledFor,
  });
  if (error) throw rpcError(error);
  return String(data);
}

/** Aktif postu olmayan ogeleri her gun 20:00'ye planlar. Doner: planlanan adet. */
export async function scheduleAllSocial(
  client: SupabaseClient,
  args: { projectId: string; platforms: SocialPlatform[] },
): Promise<number> {
  const { data, error } = await client.rpc("helm_social_schedule_all", {
    p_project_id: args.projectId,
    p_platforms: args.platforms,
  });
  if (error) throw rpcError(error);
  return Number(data ?? 0);
}

/** Yalnizca `scheduled` durumdaki post iptal edilebilir; sunucu dogrular. */
export async function cancelSocialPost(client: SupabaseClient, postId: string): Promise<void> {
  const { error } = await client.rpc("helm_social_cancel", { p_post_id: postId });
  if (error) throw rpcError(error);
}

/** Durum yenilemeyi kuyruga atar; sonuc asenkron gelir (~5 sn sonra tekrar oku). */
export async function refreshSocialPosts(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc("helm_social_refresh");
  if (error) throw rpcError(error);
}

const ACTIVE: ReadonlySet<SocialPostStatus> = new Set([
  "sending",
  "scheduled",
  "publishing",
  "published",
  "partial",
]);

/** Aktif post: ayni oge icin yeni yayin acilamaz (sunucu kurali ile ayni kume). */
export function isActivePost(status: SocialPostStatus): boolean {
  return ACTIVE.has(status);
}

/**
 * Kutuphane ogesi basina en yeni post.
 * Time: O(n), Space: O(k) k = postu olan oge sayisi. Siralama varsayimi yok.
 */
export function latestPostByLibrary(posts: readonly SocialPost[]): Map<string, SocialPost> {
  const latest = new Map<string, SocialPost>();
  for (const post of posts) {
    if (post.library_id == null) continue;
    const current = latest.get(post.library_id);
    if (current == null || Date.parse(post.created_at) > Date.parse(current.created_at)) {
      latest.set(post.library_id, post);
    }
  }
  return latest;
}

/** Bir kutuphane satirinin gosterilen durumu - en yeni posttan turer. */
export type SocialItemState =
  | { kind: "ready" }
  | { kind: "scheduled"; at: string | null }
  | { kind: "publishing" }
  | { kind: "published" }
  | { kind: "failed" };

export function socialItemState(post: SocialPost | undefined): SocialItemState {
  if (post == null || post.status === "cancelled") return { kind: "ready" };
  switch (post.status) {
    case "scheduled":
      return { kind: "scheduled", at: post.scheduled_for };
    case "sending":
    case "publishing":
      return { kind: "publishing" };
    case "published":
    case "partial":
      return { kind: "published" };
    case "failed":
      return { kind: "failed" };
  }
}

export interface SocialQueue {
  /** sending/scheduled/publishing - planlanan zamana gore artan. */
  scheduled: SocialPost[];
  /** published/partial - yayin zamanina gore azalan. */
  published: SocialPost[];
  failed: SocialPost[];
}

const timeOf = (iso: string | null, fallback: string): number => Date.parse(iso ?? fallback);

/**
 * Kuyruk bolumleri. Iptal edilenler gosterilmez.
 * Time: O(n log n) siralama, Space: O(n).
 */
export function groupSocialQueue(posts: readonly SocialPost[]): SocialQueue {
  const queue: SocialQueue = { scheduled: [], published: [], failed: [] };
  for (const post of posts) {
    if (post.status === "failed") queue.failed.push(post);
    else if (post.status === "published" || post.status === "partial") queue.published.push(post);
    else if (post.status !== "cancelled") queue.scheduled.push(post);
  }
  queue.scheduled.sort(
    (a, b) => timeOf(a.scheduled_for, a.created_at) - timeOf(b.scheduled_for, b.created_at),
  );
  queue.published.sort(
    (a, b) => timeOf(b.published_at, b.updated_at) - timeOf(a.published_at, a.updated_at),
  );
  queue.failed.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  return queue;
}
