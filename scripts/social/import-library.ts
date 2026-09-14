#!/usr/bin/env bun
// Sosyal kutuphane ice aktarma: manifest -> Zernio medya -> social_library.
//
//   ZERNIO_API_KEY=... bun run scripts/social/import-library.ts \
//     --manifest <publish-manifest.json> --project <uuid> --campaign <slug> [--dry-run] [--force]
//
// Repoda VERI YOK: icerik (caption, video) private manifest'ten ve diskten gelir.
// Her oge icin: ffprobe sure, ffmpeg 0.6. saniye kapak (540x960 jpg), Zernio
// presign ile video + kapak yukleme, (project_id, code) uzerinden upsert.
// Videosu yuklu oge --force olmadan yeniden YUKLENMEZ; metin alanlari (caption,
// hook, sira) yine manifest'ten guncellenir - caption duzeltmesi 21 video
// yuklemesi gerektirmesin.
//
// Cikti: kod, boyut, sonuc. Anahtar ve DB URL'i hic yazilmaz.
// Time: O(n) oge, sirali (Zernio 60 istek/dk; oge basina 2 presign).

import { SQL } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  USAGE,
  formatBytes,
  parseImportArgs,
  readEnvValue,
  validateManifest,
  videoContentType,
  type ImportArgs,
  type ManifestItem,
} from "./library-manifest";

const ZERNIO_BASE = "https://zernio.com/api/v1";
const COVER_AT_SEC = "0.6";
const REPO_ROOT = resolve(import.meta.dir, "..", "..");

interface Uploaded {
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  videoBytes: number;
  coverBytes: number;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function loadDbUrl(): Promise<string> {
  if (process.env.HELM_DB_URL) return process.env.HELM_DB_URL;
  const envFile = Bun.file(join(REPO_ROOT, ".env"));
  const value = (await envFile.exists()) ? readEnvValue(await envFile.text(), "HELM_DB_URL") : null;
  return value ?? fail("HELM_DB_URL bulunamadi (repo .env).");
}

/** Komutu calistirir, stdout doner. Hata mesajina yalnizca stderr kuyrugu girer. */
async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`${cmd[0]} cikis ${code}: ${err.trim().slice(-300)}`);
  return out;
}

function requireBinary(name: string): string {
  return Bun.which(name) ?? fail(`${name} bulunamadi (PATH).`);
}

async function probeDuration(ffprobe: string, file: string): Promise<number> {
  const out = await run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  const seconds = Number.parseFloat(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`gecersiz sure: ${out.trim()}`);
  return Math.round(seconds * 100) / 100;
}

/** 9:16 dolacak sekilde olcekle + kirp: farkli oranli kaynak basik gorunmesin. */
async function extractCover(ffmpeg: string, file: string, out: string): Promise<void> {
  await run([
    ffmpeg, "-y", "-v", "error", "-ss", COVER_AT_SEC, "-i", file, "-frames:v", "1",
    "-vf", "scale=540:960:force_original_aspect_ratio=increase,crop=540:960", "-q:v", "3", out,
  ]);
}

/** 429/5xx'te bir kez bekleyip tekrar dener. Govde loglanmaz, yalnizca kisa hata. */
async function zernioPresign(apiKey: string, filename: string, contentType: string, size: number) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${ZERNIO_BASE}/media/presign`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filename, contentType, size }),
    });
    if (res.ok) {
      const body = (await res.json()) as { uploadUrl?: string; publicUrl?: string };
      if (!body.uploadUrl || !body.publicUrl) throw new Error("presign yaniti eksik");
      return { uploadUrl: body.uploadUrl, publicUrl: body.publicUrl };
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 2) {
      const text = (await res.text()).slice(0, 200);
      throw new Error(`presign ${res.status}: ${text}`);
    }
    const waitSec = Number(res.headers.get("retry-after")) || 5;
    await Bun.sleep(Math.min(waitSec, 60) * 1000);
  }
}

async function putFile(uploadUrl: string, path: string, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: Bun.file(path) });
  if (!res.ok) throw new Error(`yukleme ${res.status}`);
}

async function uploadItem(
  apiKey: string,
  bins: { ffmpeg: string; ffprobe: string },
  campaign: string,
  item: ManifestItem,
  videoPath: string,
  workDir: string,
): Promise<Uploaded> {
  const videoType = videoContentType(item.file) ?? fail(`${item.code}: desteklenmeyen video uzantisi`);
  const ext = item.file.split(".").pop()!.toLowerCase();
  const durationSec = await probeDuration(bins.ffprobe, videoPath);
  const coverPath = join(workDir, `${item.code}.jpg`);
  await extractCover(bins.ffmpeg, videoPath, coverPath);

  const videoBytes = Bun.file(videoPath).size;
  const coverBytes = Bun.file(coverPath).size;
  const video = await zernioPresign(apiKey, `${campaign}-${item.code}.${ext}`, videoType, videoBytes);
  await putFile(video.uploadUrl, videoPath, videoType);
  const cover = await zernioPresign(apiKey, `${campaign}-${item.code}-cover.jpg`, "image/jpeg", coverBytes);
  await putFile(cover.uploadUrl, coverPath, "image/jpeg");

  return { videoUrl: video.publicUrl, thumbnailUrl: cover.publicUrl, durationSec, videoBytes, coverBytes };
}

/** Medya alanlari null gelirse mevcut deger korunur (yalnizca metin guncellemesi). */
async function upsertRow(sql: SQL, args: ImportArgs, item: ManifestItem, media: Uploaded | null): Promise<void> {
  await sql`
    insert into public.social_library (
      project_id, campaign, code, sort_order, hook, voice,
      video_url, thumbnail_url, duration_sec,
      tiktok_caption, instagram_caption, pinned_comment
    ) values (
      ${args.project}, ${args.campaign}, ${item.code}, ${item.order}, ${item.hook}, ${item.voice},
      ${media?.videoUrl ?? null}, ${media?.thumbnailUrl ?? null}, ${media?.durationSec ?? null},
      ${item.captions.tiktok}, ${item.captions.instagram}, ${item.pinnedComment}
    )
    on conflict (project_id, code) do update set
      campaign = excluded.campaign,
      sort_order = excluded.sort_order,
      hook = excluded.hook,
      voice = excluded.voice,
      video_url = coalesce(excluded.video_url, social_library.video_url),
      thumbnail_url = coalesce(excluded.thumbnail_url, social_library.thumbnail_url),
      duration_sec = coalesce(excluded.duration_sec, social_library.duration_sec),
      tiktok_caption = excluded.tiktok_caption,
      instagram_caption = excluded.instagram_caption,
      pinned_comment = excluded.pinned_comment
  `;
}

async function loadManifest(path: string) {
  const file = Bun.file(path);
  if (!(await file.exists())) fail(`manifest yok: ${path}`);
  let raw: unknown;
  try {
    raw = await file.json();
  } catch {
    fail("manifest JSON olarak okunamadi");
  }
  const parsed = validateManifest(raw);
  if (!parsed.ok) fail(`manifest gecersiz:\n  ${parsed.errors.join("\n  ")}`);
  return parsed.value;
}

async function main(): Promise<void> {
  const parsedArgs = parseImportArgs(Bun.argv.slice(2));
  if (!parsedArgs.ok) fail(`${parsedArgs.errors.join("\n")}\n${USAGE}`);
  const args = parsedArgs.value;

  const manifestPath = resolve(args.manifest);
  const manifest = await loadManifest(manifestPath);
  const videoDir = resolve(dirname(manifestPath), "..", manifest.videoDir);

  // Tum dosyalari yuklemeden once kontrol et: eksik dosya yarim import birakmasin.
  const missing: string[] = [];
  for (const item of manifest.items) {
    if (!(await Bun.file(join(videoDir, item.file)).exists())) missing.push(`${item.code} (${item.file})`);
  }
  if (missing.length > 0) fail(`video bulunamadi:\n  ${missing.join("\n  ")}`);

  const apiKey = process.env.ZERNIO_API_KEY ?? "";
  if (!args.dryRun && !apiKey) fail("ZERNIO_API_KEY env gerekli (--dry-run haric).");
  const bins = { ffmpeg: requireBinary("ffmpeg"), ffprobe: requireBinary("ffprobe") };

  const sql = new SQL(await loadDbUrl());
  const workDir = await mkdtemp(join(tmpdir(), "helm-social-import-"));
  let uploaded = 0;
  let metaOnly = 0;
  let failed = 0;
  let totalBytes = 0;

  try {
    const [project] = await sql`select 1 as ok from public.properties where id = ${args.project}`;
    if (!project) fail("proje bulunamadi");

    const existing = new Map<string, string | null>();
    for (const row of await sql`select code, video_url from public.social_library where project_id = ${args.project}`) {
      existing.set(row.code as string, (row.video_url as string | null) ?? null);
    }

    console.log(`${manifest.items.length} oge${args.dryRun ? " (dry-run: yukleme ve yazma yok)" : ""}`);
    const ordered = [...manifest.items].sort((a, b) => a.order - b.order);

    for (const item of ordered) {
      const videoPath = join(videoDir, item.file);
      const label = item.code.padEnd(4);
      const hasVideo = Boolean(existing.get(item.code));
      try {
        if (hasVideo && !args.force) {
          if (!args.dryRun) await upsertRow(sql, args, item, null);
          metaOnly++;
          console.log(`${label} atla   video yuklu, metin ${args.dryRun ? "guncellenecek" : "guncellendi"}`);
          continue;
        }
        if (args.dryRun) {
          const duration = await probeDuration(bins.ffprobe, videoPath);
          console.log(`${label} yukle  ${formatBytes(Bun.file(videoPath).size)}, ${duration}s`);
          continue;
        }
        const media = await uploadItem(apiKey, bins, args.campaign, item, videoPath, workDir);
        await upsertRow(sql, args, item, media);
        uploaded++;
        totalBytes += media.videoBytes + media.coverBytes;
        console.log(`${label} ok     video ${formatBytes(media.videoBytes)}, kapak ${formatBytes(media.coverBytes)}, ${media.durationSec}s`);
      } catch (err) {
        failed++;
        console.log(`${label} HATA   ${(err as Error).message}`);
      }
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
    await sql.close();
  }

  console.log(`\nyuklenen ${uploaded} (${formatBytes(totalBytes)}), yalnizca metin ${metaOnly}, hatali ${failed}`);
  if (failed > 0) process.exit(1);
}

await main();
