import { describe, expect, it } from "bun:test";
import {
  groupSocialQueue,
  isActivePost,
  latestPostByLibrary,
  socialItemState,
  type SocialPost,
  type SocialPostStatus,
} from "./social-publishing";

// Sentetik veri - gercek icerik/hesap/id repoya girmez (repo public).
const post = (
  id: string,
  libraryId: string | null,
  status: SocialPostStatus,
  createdAt: string,
  extra: Partial<SocialPost> = {},
): SocialPost => ({
  id,
  project_id: "p1",
  library_id: libraryId,
  zernio_post_id: null,
  status,
  scheduled_for: null,
  published_at: null,
  platforms: [],
  error: null,
  created_at: createdAt,
  updated_at: createdAt,
  ...extra,
});

describe("latestPostByLibrary", () => {
  it("siradan bagimsiz olarak oge basina en yeni postu secer", () => {
    const posts = [
      post("a", "L1", "failed", "2026-09-10T10:00:00Z"),
      post("b", "L1", "scheduled", "2026-09-12T10:00:00Z"),
      post("c", "L1", "cancelled", "2026-09-11T10:00:00Z"),
      post("d", "L2", "published", "2026-09-09T10:00:00Z"),
      post("e", null, "published", "2026-09-13T10:00:00Z"),
    ];
    const latest = latestPostByLibrary(posts);
    expect(latest.get("L1")?.id).toBe("b");
    expect(latest.get("L2")?.id).toBe("d");
    expect(latest.size).toBe(2);
  });

  it("bos listede bos map doner", () => {
    expect(latestPostByLibrary([]).size).toBe(0);
  });
});

describe("isActivePost", () => {
  it("sunucunun aktif kumesiyle ayni", () => {
    const active: SocialPostStatus[] = ["sending", "scheduled", "publishing", "published", "partial"];
    for (const s of active) expect(isActivePost(s)).toBe(true);
    expect(isActivePost("failed")).toBe(false);
    expect(isActivePost("cancelled")).toBe(false);
  });
});

describe("socialItemState", () => {
  it("post yoksa ya da iptal edildiyse hazir", () => {
    expect(socialItemState(undefined).kind).toBe("ready");
    expect(socialItemState(post("x", "L", "cancelled", "2026-09-01T00:00:00Z")).kind).toBe("ready");
  });

  it("planli postun zamanini tasir, kismi yayin yayinda sayilir", () => {
    const s = socialItemState(
      post("x", "L", "scheduled", "2026-09-01T00:00:00Z", { scheduled_for: "2026-09-15T17:00:00Z" }),
    );
    expect(s).toEqual({ kind: "scheduled", at: "2026-09-15T17:00:00Z" });
    expect(socialItemState(post("y", "L", "partial", "2026-09-01T00:00:00Z")).kind).toBe("published");
    expect(socialItemState(post("z", "L", "sending", "2026-09-01T00:00:00Z")).kind).toBe("publishing");
  });
});

describe("groupSocialQueue", () => {
  it("bolumlere ayirir, iptali atar ve her bolumu dogru yone siralar", () => {
    const q = groupSocialQueue([
      post("s2", "L", "scheduled", "2026-09-01T00:00:00Z", { scheduled_for: "2026-09-16T17:00:00Z" }),
      post("s1", "L", "scheduled", "2026-09-02T00:00:00Z", { scheduled_for: "2026-09-15T17:00:00Z" }),
      post("p1", "L", "published", "2026-09-01T00:00:00Z", { published_at: "2026-09-10T17:00:00Z" }),
      post("p2", "L", "partial", "2026-09-01T00:00:00Z", { published_at: "2026-09-11T17:00:00Z" }),
      post("f1", "L", "failed", "2026-09-03T00:00:00Z"),
      post("c1", "L", "cancelled", "2026-09-03T00:00:00Z"),
    ]);
    expect(q.scheduled.map((p) => p.id)).toEqual(["s1", "s2"]);
    expect(q.published.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(q.failed.map((p) => p.id)).toEqual(["f1"]);
  });
});
