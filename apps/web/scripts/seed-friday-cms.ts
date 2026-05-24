#!/usr/bin/env bun
// helm — Friday CMS seed (idempotent).
// projects (friday) + cms_collections (pages singleton) + cms_entries (home/tr/draft).
// Çalıştırma: bun run scripts/seed-friday-cms.ts
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_HELM_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error(
    "❌ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY env vars gerekli.",
  );
  process.exit(1);
}

const sb = createClient(URL, KEY, {
  auth: { persistSession: false },
});

const PROJECT_SLUG = "friday";
const PROJECT_NAME = "Friday";

const SCHEMA = {
  fields: [
    { kind: "text", name: "title", label: "Başlık", required: true },
    { kind: "textarea", name: "subtitle", label: "Alt başlık", rows: 2 },
    { kind: "richtext", name: "body", label: "İçerik" },
  ],
};

const EMPTY_PLATE = [{ type: "p", children: [{ text: "" }] }];

async function ensureProject(): Promise<string> {
  const { data: existing } = await sb
    .from("projects")
    .select("id")
    .eq("slug", PROJECT_SLUG)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await sb
    .from("projects")
    .insert({ name: PROJECT_NAME, slug: PROJECT_SLUG })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureCollection(projectId: string): Promise<string> {
  const { data: existing } = await sb
    .from("cms_collections")
    .select("id")
    .eq("project_id", projectId)
    .eq("slug", "pages")
    .maybeSingle();
  if (existing?.id) {
    // şemayı her seedde güncelle (idempotent)
    await sb
      .from("cms_collections")
      .update({ schema: SCHEMA, label: "Sayfalar", kind: "singleton" })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await sb
    .from("cms_collections")
    .insert({
      project_id: projectId,
      slug: "pages",
      label: "Sayfalar",
      kind: "singleton",
      schema: SCHEMA,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureEntry(collectionId: string, projectId: string) {
  const { data: existing } = await sb
    .from("cms_entries")
    .select("id")
    .eq("collection_id", collectionId)
    .eq("slug", "home")
    .eq("locale", "tr")
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await sb
    .from("cms_entries")
    .insert({
      collection_id: collectionId,
      project_id: projectId,
      slug: "home",
      locale: "tr",
      status: "draft",
      data: {
        title: "Anasayfa",
        subtitle: "Friday — odaklan, geri kalanını biz hallederiz.",
        body: EMPTY_PLATE,
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  console.log("➜ Friday projesi…");
  const projectId = await ensureProject();
  console.log(`  ✓ project_id = ${projectId}`);

  console.log("➜ pages collection (singleton)…");
  const collectionId = await ensureCollection(projectId);
  console.log(`  ✓ collection_id = ${collectionId}`);

  console.log("➜ home/tr entry (taslak)…");
  const entryId = await ensureEntry(collectionId, projectId);
  console.log(`  ✓ entry_id = ${entryId}`);

  console.log("\n✅ Seed tamam. Helm'i aç → /cms/entries → home satırına tıkla.");
}

main().catch((e) => {
  console.error("❌ Seed başarısız:", e);
  process.exit(1);
});
