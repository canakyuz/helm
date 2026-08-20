import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-cms-publish - bir entry'yi yayınla + hedef sitelere webhook gönder.
//
// Body: { entry_id: string, action?: 'publish' | 'invalidate_only', note?: string }
// Yanıt: { tags: string[], results: Array<{ target, ok, status, error? }> }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface PublishTarget {
  name: string;
  url: string;
  secret: string;
  locales?: string[];
}

interface EntryRow {
  id: string;
  data: Record<string, unknown>;
  slug: string;
  locale: string;
  status: "draft" | "published";
  collection_id: string;
  cms_collections: {
    slug: string;
    kind: "collection" | "singleton";
    project_id: string;
    projects: {
      cms_publish_targets: PublishTarget[] | null;
    };
  };
}

function buildTags(
  collectionSlug: string,
  collectionKind: "collection" | "singleton",
  entrySlug: string,
  locale: string,
): string[] {
  const itemTag = `cms:${collectionSlug}:${entrySlug}:${locale}`;
  if (collectionKind === "singleton") {
    // singleton'da liste yok; sadece item tag (+ collection-level eski tag pattern uyumu)
    return [itemTag, `cms:${collectionSlug}:${locale}`];
  }
  // collection: item + list
  return [itemTag, `cms:list:${collectionSlug}:${locale}`];
}

async function postWebhook(
  target: PublishTarget,
  payload: { tags: string[]; entry: { slug: string; locale: string } },
): Promise<{ target: string; ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-helm-secret": target.secret,
      },
      body: JSON.stringify(payload),
    });
    return {
      target: target.name,
      ok: res.ok,
      status: res.status,
      error: res.ok ? undefined : await res.text().catch(() => undefined),
    };
  } catch (e) {
    return {
      target: target.name,
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let entryId: string | undefined;
  let action: "publish" | "invalidate_only" = "publish";
  let note: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.entry_id === "string") entryId = body.entry_id;
    if (body?.action === "invalidate_only") action = "invalidate_only";
    if (typeof body?.note === "string") note = body.note;
  } catch {
    // gövde yok
  }
  if (!entryId) return json({ error: "entry_id gerekli" }, 400);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Entry + collection + project'i tek query'de joinle
  const { data: row, error: entryErr } = await hub
    .from("cms_entries")
    .select(
      `id, data, slug, locale, status, collection_id,
       cms_collections!inner (
         slug, kind, project_id,
         projects!inner ( cms_publish_targets )
       )`,
    )
    .eq("id", entryId)
    .maybeSingle();
  if (entryErr) return json({ error: entryErr.message }, 500);
  if (!row) return json({ error: "Entry not found" }, 404);
  const entry = row as unknown as EntryRow;

  // 1) Publish (revision snapshot + status update)
  if (action === "publish") {
    const { error: revErr } = await hub.from("cms_revisions").insert({
      entry_id: entry.id,
      data: entry.data,
      status_at_snapshot: "published",
      note,
    });
    if (revErr) return json({ error: `revision: ${revErr.message}` }, 500);

    const { error: updErr } = await hub
      .from("cms_entries")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
    if (updErr) return json({ error: `entry update: ${updErr.message}` }, 500);
  }

  // 2) Tag listesi
  const tags = buildTags(
    entry.cms_collections.slug,
    entry.cms_collections.kind,
    entry.slug,
    entry.locale,
  );

  // 3) Targets (locale filter uygula)
  const targets = entry.cms_collections.projects.cms_publish_targets ?? [];
  const matched = targets.filter(
    (t) =>
      !t.locales || t.locales.length === 0 || t.locales.includes(entry.locale),
  );

  // 4) Paralel webhook gönder
  const results = await Promise.all(
    matched.map((t) =>
      postWebhook(t, {
        tags,
        entry: { slug: entry.slug, locale: entry.locale },
      }),
    ),
  );

  return json({
    entry_id: entry.id,
    action,
    tags,
    targets_total: targets.length,
    targets_matched: matched.length,
    results,
  });
});
