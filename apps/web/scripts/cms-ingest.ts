#!/usr/bin/env bun
// helm — generic CMS ingest: en.json → tipli şema (inference) → cms_collections.schema.
// Drift governance'ın "tek-sefer / dev-tetikli" ucu: runtime ASLA infer etmez, sadece bu.
//
// Kullanım (helm/apps/web içinden):
//   bun run scripts/cms-ingest.ts <target> [--reset-data]
//   <target>: friday | wesan
//   --reset-data: mevcut entry.data'yı kaynaktan EZER (ilk unwrap migrasyonu için).
//                 Varsayılan: fillMissing → yeni key ekler, düzenlenmiş değeri korur.
//
// Env (helm/.env.local'dan auto-load):
//   VITE_HELM_SUPABASE_URL | SUPABASE_URL ·  SERVICE_ROLE_KEY | SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { inferSchema } from "../src/lib/cms-infer";
import { mergeSchema } from "../src/lib/cms-merge";
import type { CollectionSchema } from "../src/types/cms";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Target {
  brandSlug: string;
  brandName: string;
  propertySlug: string;
  propertyName: string;
  collectionSlug: string;
  collectionLabel: string;
  entrySlug: string;
  locale: string;
  bundleRelPath: string; // scripts dizininden göreli
}

// priv/<repo> helm'in kardeşi: apps/web/scripts → ../../../../<repo>
const TARGETS: Record<string, Target> = {
  friday: {
    brandSlug: "friday",
    brandName: "Friday",
    propertySlug: "friday",
    propertyName: "Friday",
    collectionSlug: "site-bundle",
    collectionLabel: "Site bundle",
    entrySlug: "en",
    locale: "en",
    bundleRelPath: "../../../../friday/web/content/en.json",
  },
  wesan: {
    brandSlug: "wesan",
    brandName: "Wesan",
    propertySlug: "wesan",
    propertyName: "Wesan",
    collectionSlug: "site-bundle",
    collectionLabel: "Site bundle",
    entrySlug: "en",
    locale: "en",
    bundleRelPath: "../../../../wesan/content/en.json",
  },
};

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

const targetKey = process.argv[2];
const resetData = process.argv.includes("--reset-data");
if (!targetKey || !TARGETS[targetKey]) {
  fail(`Geçersiz hedef. Kullanım: bun run scripts/cms-ingest.ts <${Object.keys(TARGETS).join("|")}> [--reset-data]`);
}
const T = TARGETS[targetKey];

const URL = process.env.SUPABASE_URL ?? process.env.VITE_HELM_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if (!URL || !URL.startsWith("http")) fail("Geçersiz Supabase URL (helm/.env.local).");
if (!KEY) fail("SERVICE_ROLE_KEY eksik (helm/.env.local).");

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const bundlePath = resolve(__dirname, T.bundleRelPath);
const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown>;

// Re-ingest: kaynaktaki yeni key'leri ekle, mevcut (düzenlenmiş) değeri KORU. Diziler
// kullanıcı yönetiminde — varsa dokunma. _meta dahil pass-through.
const fillMissing = (target: unknown, source: unknown): unknown => {
  if (Array.isArray(source)) return target ?? source;
  if (source && typeof source === "object") {
    const t =
      target && typeof target === "object" && !Array.isArray(target)
        ? { ...(target as Record<string, unknown>) }
        : {};
    for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
      t[k] = fillMissing(t[k], v);
    }
    return t;
  }
  return target === undefined ? source : target;
};

async function ensureBrand(): Promise<string> {
  const { data: existing } = await sb.from("brands").select("id").eq("slug", T.brandSlug).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await sb.from("brands").insert({ name: T.brandName, slug: T.brandSlug }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function ensureProperty(brandId: string): Promise<string> {
  const { data: existing } = await sb.from("properties").select("id").eq("slug", T.propertySlug).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await sb
    .from("properties")
    .insert({ brand_id: brandId, name: T.propertyName, slug: T.propertySlug, type: "website", enabled_modules: ["cms"] })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureCollection(propertyId: string): Promise<{ id: string; schema: CollectionSchema }> {
  // 1) en.json → inferred FieldDef[] (_meta hariç, object/list/primitive).
  const inferred = inferSchema([bundle]);

  const { data: existing } = await sb
    .from("cms_collections")
    .select("id, schema")
    .eq("project_id", propertyId)
    .eq("slug", T.collectionSlug)
    .maybeSingle();

  const existingSchema = (existing?.schema as CollectionSchema | undefined) ?? null;
  // Eski tek-json-field şemasını sözleşme saymayız (unwrap migrasyonu) → boş gibi davran.
  const isLegacyJson =
    existingSchema?.fields?.length === 1 && existingSchema.fields[0]?.kind === "json";
  const { fields, report } = mergeSchema(isLegacyJson ? null : existingSchema, inferred);
  const schema: CollectionSchema = { fields };

  console.log(`  ↳ alan: +${report.added.length} eklendi · ${report.removed.length} korundu(kaynakta yok) · ${report.conflicts.length} çakışma`);
  if (report.removed.length) console.log(`     korunan: ${report.removed.slice(0, 10).join(", ")}${report.removed.length > 10 ? "…" : ""}`);
  if (report.conflicts.length) console.log(`     ⚠ çakışma: ${report.conflicts.join(", ")}`);

  if (existing?.id) {
    const { error } = await sb
      .from("cms_collections")
      .update({ schema, label: T.collectionLabel, kind: "singleton" })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, schema };
  }
  const { data, error } = await sb
    .from("cms_collections")
    .insert({ project_id: propertyId, slug: T.collectionSlug, label: T.collectionLabel, kind: "singleton", schema })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, schema };
}

async function ensureEntry(collectionId: string, propertyId: string): Promise<string> {
  const { data: existing } = await sb
    .from("cms_entries")
    .select("id, data")
    .eq("collection_id", collectionId)
    .eq("slug", T.entrySlug)
    .eq("locale", T.locale)
    .maybeSingle();

  if (existing?.id) {
    // unwrap shape: data = en.json (artık {bundle} sarmalı yok).
    const nextData = resetData
      ? bundle
      : fillMissing(existing.data, bundle);
    console.log(`  ↳ entry.data ${resetData ? "EZİLDİ (--reset-data)" : "fillMissing (edit'ler korundu)"}`);
    const { error } = await sb.from("cms_entries").update({ data: nextData }).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await sb
    .from("cms_entries")
    .insert({
      collection_id: collectionId,
      project_id: propertyId,
      slug: T.entrySlug,
      locale: T.locale,
      status: "draft" as const,
      data: bundle,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  console.log(`➜ Ingest "${targetKey}" · bundle: ${bundlePath}`);
  console.log(`  top-level: ${Object.keys(bundle).join(", ")}`);
  const brandId = await ensureBrand();
  const propertyId = await ensureProperty(brandId);
  console.log(`➜ Collection "${T.collectionSlug}"…`);
  const { id: collectionId, schema } = await ensureCollection(propertyId);
  console.log(`  ✓ collection_id = ${collectionId} · ${schema.fields.length} top-level alan`);
  const entryId = await ensureEntry(collectionId, propertyId);
  console.log(`  ✓ entry_id = ${entryId}`);
  console.log(`\n✅ Ingest tamam. Helm → ${T.propertyName} → İçerikler → ${T.entrySlug} → tipli panel.`);
}

main().catch((e) => {
  console.error("❌ Ingest başarısız:", e);
  process.exit(1);
});
