// import-library.ts'in SAF katmani: arguman, manifest dogrulama, .env okuma.
// IO yok (dosya, ag, DB); bun test ile sentetik veriyle kosar.
//
// NEDEN AYRI: manifest private repoda elle duzenleniyor. Bozuk bir satirin
// 21 videonun yarisi yuklendikten sonra patlamasi hem zaman hem Zernio kotasi.
// Dogrulama yuklemeden ONCE, tamamen ve tum hatalari birlikte raporlar.

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export interface ImportArgs {
  manifest: string;
  project: string;
  campaign: string;
  dryRun: boolean;
  force: boolean;
}

export interface ManifestItem {
  code: string;
  order: number;
  file: string;
  hook: string;
  voice: string | null;
  captions: { tiktok: string; instagram: string };
  pinnedComment: string | null;
}

export interface Manifest {
  version: number;
  videoDir: string;
  items: ManifestItem[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;
const CAMPAIGN_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
// Dizin ayiraci ya da ".." iceren dosya adi manifest klasorunun disina cikar.
const SAFE_NAME_RE = /^(?!\.)[^/\\]+$/;

const VALUE_FLAGS = new Set(["--manifest", "--project", "--campaign"]);
const BOOL_FLAGS = new Set(["--dry-run", "--force"]);

export const USAGE =
  "kullanim: bun run scripts/social/import-library.ts --manifest <json> --project <uuid> --campaign <slug> [--dry-run] [--force]";

/** Time: O(a) a arguman sayisi. */
export function parseImportArgs(argv: readonly string[]): Result<ImportArgs> {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const errors: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (BOOL_FLAGS.has(arg)) {
      flags.add(arg);
      continue;
    }
    if (!VALUE_FLAGS.has(arg)) {
      errors.push(`bilinmeyen arguman: ${arg}`);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      errors.push(`${arg} bir deger bekliyor`);
      continue;
    }
    values.set(arg, next);
    i++;
  }

  const manifest = values.get("--manifest");
  const project = values.get("--project");
  const campaign = values.get("--campaign");
  if (!manifest) errors.push("--manifest zorunlu");
  if (!project) errors.push("--project zorunlu");
  else if (!UUID_RE.test(project)) errors.push("--project gecerli bir uuid degil");
  if (!campaign) errors.push("--campaign zorunlu");
  else if (!CAMPAIGN_RE.test(campaign)) errors.push("--campaign kucuk harf, rakam ve tire olmali");

  if (errors.length > 0 || !manifest || !project || !campaign) return { ok: false, errors };
  return {
    ok: true,
    value: { manifest, project, campaign, dryRun: flags.has("--dry-run"), force: flags.has("--force") },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNullableString = (v: unknown): v is string | null => v === null || typeof v === "string";

function validateItem(raw: unknown, at: string, errors: string[]): ManifestItem | null {
  if (!isRecord(raw)) {
    errors.push(`${at}: nesne degil`);
    return null;
  }
  const before = errors.length;
  const { code, order, file, hook, voice, captions, pinned_comment } = raw;

  if (typeof code !== "string" || !CODE_RE.test(code)) errors.push(`${at}.code: harf/rakam/_/- (1-40)`);
  if (typeof order !== "number" || !Number.isInteger(order)) errors.push(`${at}.order: tam sayi olmali`);
  if (typeof file !== "string" || !SAFE_NAME_RE.test(file)) errors.push(`${at}.file: klasorsuz dosya adi olmali`);
  if (typeof hook !== "string") errors.push(`${at}.hook: metin olmali`);
  if (!isNullableString(voice ?? null)) errors.push(`${at}.voice: metin ya da null olmali`);
  if (!isNullableString(pinned_comment ?? null)) errors.push(`${at}.pinned_comment: metin ya da null olmali`);
  if (!isRecord(captions) || typeof captions.tiktok !== "string" || typeof captions.instagram !== "string") {
    errors.push(`${at}.captions: {tiktok, instagram} metin olmali`);
  }
  if (errors.length > before || !isRecord(captions)) return null;

  return {
    code: code as string,
    order: order as number,
    file: file as string,
    hook: hook as string,
    voice: (voice as string | null | undefined) ?? null,
    captions: { tiktok: captions.tiktok as string, instagram: captions.instagram as string },
    pinnedComment: (pinned_comment as string | null | undefined) ?? null,
  };
}

/**
 * Manifest'i dogrular; tum hatalari birlikte doner. Fazla alanlar yok sayilir
 * (manifest baska araclarin da kaynagi). Time: O(n), Space: O(n) - kod tekilligi Set ile.
 */
export function validateManifest(raw: unknown): Result<Manifest> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["manifest bir JSON nesnesi degil"] };

  const { version, video_dir, items } = raw;
  if (typeof version !== "number") errors.push("version: sayi olmali");
  if (typeof video_dir !== "string" || !SAFE_NAME_RE.test(video_dir)) errors.push("video_dir: klasor adi olmali");
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("items: bos olmayan dizi olmali");
    return { ok: false, errors };
  }

  const seen = new Set<string>();
  const valid: ManifestItem[] = [];
  items.forEach((it, i) => {
    const item = validateItem(it, `items[${i}]`, errors);
    if (!item) return;
    if (seen.has(item.code)) errors.push(`items[${i}].code: tekrar eden kod ${item.code}`);
    seen.add(item.code);
    valid.push(item);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { version: version as number, videoDir: video_dir as string, items: valid } };
}

const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
};

/** Zernio presign yalnizca listedeki MIME'lari kabul ediyor. Bilinmeyen -> null. */
export function videoContentType(file: string): string | null {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_TYPES[ext] ?? null;
}

/**
 * .env metninden tek anahtar. `export`, tirnak ve yorum satirlari desteklenir.
 * NEDEN ELLE: Bun .env'i cwd'den yukler; script repo disindan cagrilinca bos kalir.
 */
export function readEnvValue(envText: string, key: string): string | null {
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, "");
    if (!line.startsWith(`${key}=`)) continue;
    const value = line.slice(key.length + 1).trim();
    const quoted = value.match(/^(['"])(.*)\1$/);
    return quoted ? (quoted[2] ?? "") : value;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
