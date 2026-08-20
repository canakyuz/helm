#!/usr/bin/env bun
// helm - Friday marketing site CMS seed (idempotent).
// Imports priv/friday/web/content/en.json as draft site-bundle; publish from Helm UI.
//
// Run from helm/apps/web:
//   bun run scripts/seed-friday-cms.ts
//
// Env (auto-loaded from helm/.env or .env.local):
//   VITE_HELM_SUPABASE_URL or SUPABASE_URL
//   SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const URL = process.env.SUPABASE_URL ?? process.env.VITE_HELM_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!URL || URL.includes("...") || !URL.startsWith("http")) {
  fail(
    "Missing or invalid Supabase URL. Set VITE_HELM_SUPABASE_URL in helm/.env.local - do not use placeholder ... on the command line.",
  );
}
if (!KEY) {
  fail("Missing SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in helm/.env.local");
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const BRAND_SLUG = "friday";
const BRAND_NAME = "Friday";
const PROPERTY_SLUG = "friday";
const PROPERTY_NAME = "Friday";
const COLLECTION_SLUG = "site-bundle";
const ENTRY_SLUG = "en";
const LOCALE = "en";

const SCHEMA = {
  fields: [{ kind: "json" as const, name: "bundle", label: "Site bundle (en.json)", required: true }],
};

// priv/friday (sibling of priv/helm), not priv/helm/friday
const bundlePath = resolve(__dirname, "../../../../friday/web/content/en.json");
const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown>;

async function ensureBrand(): Promise<string> {
  const { data: existing } = await sb.from("brands").select("id").eq("slug", BRAND_SLUG).maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await sb
    .from("brands")
    .insert({ name: BRAND_NAME, slug: BRAND_SLUG })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureProperty(brandId: string): Promise<string> {
  const { data: existing } = await sb.from("properties").select("id").eq("slug", PROPERTY_SLUG).maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await sb
    .from("properties")
    .insert({
      brand_id: brandId,
      name: PROPERTY_NAME,
      slug: PROPERTY_SLUG,
      type: "website",
      enabled_modules: ["cms"],
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureCollection(propertyId: string): Promise<string> {
  const { data: existing } = await sb
    .from("cms_collections")
    .select("id")
    .eq("project_id", propertyId)
    .eq("slug", COLLECTION_SLUG)
    .maybeSingle();

  if (existing?.id) {
    await sb
      .from("cms_collections")
      .update({ schema: SCHEMA, label: "Site bundle", kind: "singleton" })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await sb
    .from("cms_collections")
    .insert({
      project_id: propertyId,
      slug: COLLECTION_SLUG,
      label: "Site bundle",
      kind: "singleton",
      schema: SCHEMA,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureEntry(collectionId: string, propertyId: string): Promise<string> {
  const { data: existing } = await sb
    .from("cms_entries")
    .select("id, status")
    .eq("collection_id", collectionId)
    .eq("slug", ENTRY_SLUG)
    .eq("locale", LOCALE)
    .maybeSingle();

  const payload = {
    collection_id: collectionId,
    project_id: propertyId,
    slug: ENTRY_SLUG,
    locale: LOCALE,
    status: "draft" as const,
    data: { bundle },
  };

  if (existing?.id) {
    const { error } = await sb.from("cms_entries").update({ data: payload.data }).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await sb.from("cms_entries").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

async function main() {
  console.log(`➜ Loading bundle from ${bundlePath}`);
  console.log(`➜ Brand "${BRAND_SLUG}"…`);
  const brandId = await ensureBrand();
  console.log(`  ✓ brand_id = ${brandId}`);

  console.log(`➜ Property "${PROPERTY_SLUG}"…`);
  const propertyId = await ensureProperty(brandId);
  console.log(`  ✓ property_id = ${propertyId}`);

  console.log(`➜ Collection "${COLLECTION_SLUG}" (singleton)…`);
  const collectionId = await ensureCollection(propertyId);
  console.log(`  ✓ collection_id = ${collectionId}`);

  console.log(`➜ Entry "${ENTRY_SLUG}" / ${LOCALE} (draft)…`);
  const entryId = await ensureEntry(collectionId, propertyId);
  console.log(`  ✓ entry_id = ${entryId}`);

  console.log("\n✅ Friday CMS seed complete.");
  console.log("   Helm → Friday property → CMS → site-bundle → en → Publish");
  console.log("   Publish target: POST https://<friday-host>/api/revalidate  header x-helm-secret");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
