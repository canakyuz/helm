// supabase/functions/helm-review-reply/index.ts
// POST { review_id: number, body: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { sendAscReply } from "./asc-reply.ts";
import { sendPlayReply } from "./play-reply.ts";

interface Body {
  review_id?: number;
  body?: string;
}

interface ReviewRow {
  id: number;
  project_id: string;
  source: "appstore" | "playstore";
  external_id: string;
  territory: string | null;
}

const extractVendorReviewId = (externalId: string): string | null => {
  const parts = externalId.split(":");
  if (parts.length < 3) return null;
  if (parts[0] === "rss") return null;
  return parts.slice(2).join(":");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const reviewId = body.review_id;
  const replyBody = (body.body ?? "").trim();
  if (!reviewId || typeof reviewId !== "number") {
    return json({ error: "review_id gerekli (number)" }, 400);
  }
  if (replyBody.length === 0) {
    return json({ error: "The reply cannot be empty" }, 400);
  }
  if (replyBody.length > 350) {
    return json({ error: "The reply cannot exceed 350 characters" }, 422);
  }
  if (/<script|<\/script/i.test(replyBody)) {
    return json({ error: "HTML/script kabul edilmiyor" }, 422);
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let actorEmail: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    try {
      const { data } = await hub.auth.getUser(jwt);
      actorEmail = data?.user?.email ?? null;
    } catch {
      // anon — actor null kalır
    }
  }
  if (!actorEmail) {
    return json({ error: "Authenticated request gerekli" }, 401);
  }

  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: rlErr } = await hub
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_email", actorEmail)
    .eq("action", "review.reply")
    .gte("created_at", sixtySecondsAgo);
  if (rlErr) return json({ error: rlErr.message }, 500);
  if ((recentCount ?? 0) >= 10) {
    return json({ error: "Too fast — wait a minute" }, 429);
  }

  const { data: revRow, error: revErr } = await hub
    .from("reviews")
    .select("id, project_id, source, external_id, territory")
    .eq("id", reviewId)
    .maybeSingle();
  if (revErr) return json({ error: revErr.message }, 500);
  if (!revRow) return json({ error: "Review not found" }, 404);
  const review = revRow as ReviewRow;

  const vendorReviewId = extractVendorReviewId(review.external_id);
  if (!vendorReviewId) {
    return json(
      { error: "RSS-sourced reviews cannot be replied to (an ASC integration is required)" },
      422,
    );
  }

  const provider = review.source === "appstore" ? "app_store_connect" : "google_play_developer";
  const { data: integRow, error: integErr } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", review.project_id)
    .eq("provider", provider)
    .eq("enabled", true)
    .maybeSingle();
  if (integErr) return json({ error: integErr.message }, 500);
  if (!integRow) {
    return json(
      { error: `${provider} entegrasyonu yok — Settings → Integrations` },
      401,
    );
  }
  const cfg = (integRow.config ?? {}) as Record<string, string | undefined>;

  let result: { ok: true; respondedAt: string } | { ok: false; status: number; message: string };
  if (review.source === "appstore") {
    if (!cfg.key_id || !cfg.private_key) {
      return json({ error: "ASC key config eksik" }, 401);
    }
    result = await sendAscReply({
      ascKey: { key_id: cfg.key_id, issuer_id: cfg.issuer_id, private_key: cfg.private_key },
      reviewId: vendorReviewId,
      body: replyBody,
    });
  } else {
    if (!cfg.service_account_json) {
      return json({ error: "Play service account config eksik" }, 401);
    }
    let packageName = cfg.package_name ?? "";
    if (!packageName) {
      const { data: proj } = await hub
        .from("properties")
        .select("google_play_id")
        .eq("id", review.project_id)
        .maybeSingle();
      packageName = (proj as { google_play_id?: string } | null)?.google_play_id ?? "";
    }
    if (!packageName) {
      return json({ error: "Play package name not found" }, 422);
    }
    result = await sendPlayReply({
      serviceAccountJson: cfg.service_account_json,
      packageName,
      reviewId: vendorReviewId,
      body: replyBody,
    });
  }

  if (!result.ok) {
    await hub.from("audit_log").insert({
      project_id: review.project_id,
      target_user: `review:${review.id}`,
      action: "review.reply.fail",
      detail: JSON.stringify({
        source: review.source,
        status: result.status,
        message: result.message,
      }),
      actor_email: actorEmail,
    });
    const outStatus =
      result.status >= 500 ? 502 :
      result.status === 401 ? 401 :
      result.status === 429 ? 429 :
      422;
    return json({ error: result.message }, outStatus);
  }

  const { error: upErr } = await hub
    .from("reviews")
    .update({ developer_response: replyBody, responded_at: result.respondedAt })
    .eq("id", review.id);
  if (upErr) return json({ error: upErr.message }, 500);

  await hub.from("audit_log").insert({
    project_id: review.project_id,
    target_user: `review:${review.id}`,
    action: "review.reply",
    detail: JSON.stringify({
      source: review.source,
      territory: review.territory,
      body_length: replyBody.length,
    }),
    actor_email: actorEmail,
  });

  return json({ ok: true, responded_at: result.respondedAt });
});
