import { describe, expect, it } from "bun:test";
import { formatBytes, parseImportArgs, readEnvValue, validateManifest, videoContentType } from "./library-manifest";

const PROJECT = "00000000-0000-4000-8000-000000000001";

const item = (over: Record<string, unknown> = {}) => ({
  code: "A",
  order: 1,
  file: "a.mp4",
  hook: "sentetik hook",
  voice: null,
  captions: { tiktok: "tt", instagram: "ig" },
  pinned_comment: null,
  ...over,
});

describe("parseImportArgs", () => {
  it("zorunlu argumanlari ve bayraklari okur", () => {
    const r = parseImportArgs(["--manifest", "m.json", "--project", PROJECT, "--campaign", "demo-1", "--dry-run"]);
    expect(r).toEqual({
      ok: true,
      value: { manifest: "m.json", project: PROJECT, campaign: "demo-1", dryRun: true, force: false },
    });
  });

  it("eksik, gecersiz ve bilinmeyen argumanlari birlikte raporlar", () => {
    const r = parseImportArgs(["--project", "nope", "--campaign", "Bad Slug", "--wat"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain("--manifest zorunlu");
    expect(r.errors).toContain("--project gecerli bir uuid degil");
    expect(r.errors).toContain("bilinmeyen arguman: --wat");
    expect(r.errors.some((e) => e.startsWith("--campaign"))).toBe(true);
  });

  it("degersiz bayragi yakalar", () => {
    const r = parseImportArgs(["--manifest", "--force", "--project", PROJECT, "--campaign", "x"]);
    expect(r.ok).toBe(false);
  });
});

describe("validateManifest", () => {
  it("gecerli manifest'i camelCase modele cevirir, fazla alanlari yok sayar", () => {
    const r = validateManifest({
      version: 1,
      video_dir: "videos",
      extra: true,
      items: [item(), item({ code: "B", order: 2, voice: "ses", pinned_comment: "pin" })],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.videoDir).toBe("videos");
    expect(r.value.items[1]).toEqual({
      code: "B",
      order: 2,
      file: "a.mp4",
      hook: "sentetik hook",
      voice: "ses",
      captions: { tiktok: "tt", instagram: "ig" },
      pinnedComment: "pin",
    });
  });

  it("tekrar eden kodu, klasor kacisini ve eksik caption'i reddeder", () => {
    const r = validateManifest({
      version: 1,
      video_dir: "../out",
      items: [item(), item({ file: "../x.mp4" }), item({ code: "C", captions: { tiktok: "tt" } })],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain("video_dir: klasor adi olmali");
    expect(r.errors).toContain("items[1].file: klasorsuz dosya adi olmali");
    expect(r.errors).toContain("items[2].captions: {tiktok, instagram} metin olmali");
  });

  it("tekrar eden kodu yakalar", () => {
    const r = validateManifest({ version: 1, video_dir: "v", items: [item(), item()] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(["items[1].code: tekrar eden kod A"]);
  });

  it("bos ya da nesne olmayan girdiyi reddeder", () => {
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest({ version: 1, video_dir: "v", items: [] }).ok).toBe(false);
  });
});

describe("yardimcilar", () => {
  it("video MIME tipini uzantidan bulur", () => {
    expect(videoContentType("clip.MP4")).toBe("video/mp4");
    expect(videoContentType("clip.mov")).toBe("video/quicktime");
    expect(videoContentType("clip.avi")).toBeNull();
  });

  it(".env'den tirnakli ve export'lu degeri okur", () => {
    const env = "# yorum\nFOO=1\nexport DB_URL=\"postgres://u:p@h/db\"\nDB_URL_OTHER=x";
    expect(readEnvValue(env, "DB_URL")).toBe("postgres://u:p@h/db");
    expect(readEnvValue(env, "FOO")).toBe("1");
    expect(readEnvValue(env, "MISSING")).toBeNull();
  });

  it("boyutu okunur yazar", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
