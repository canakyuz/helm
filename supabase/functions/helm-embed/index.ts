// supabase/functions/helm-embed/index.ts
// Yorum metinlerini vektore cevirir ve content_embeddings'e yazar.
//
// "Neyi gomeyim" karari bu fonksiyonda DEGIL, helm_pending_embeddings
// RPC'sinde (migration 0048): hic gomulmemis veya metni degismis kayitlar
// doner. Boylece fonksiyon istedigi kadar cok kez calisabilir - ayni metin
// ikinci kez gomulmez, para ve zaman yanmaz.
//
// Gereken sir: OPENAI_API_KEY  (supabase secrets set OPENAI_API_KEY=...)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const EMBED_MODEL = "text-embedding-3-small";
/** Migration 0048'deki vector(1536) ile AYNI olmali - degistirirsen kolon da degismeli. */
const EMBED_DIM = 1536;
const OPENAI_URL = "https://api.openai.com/v1/embeddings";

/** Tek istekte gonderilecek metin sayisi. OpenAI 2048'e kadar kabul ediyor ama
 *  token tavani da var; 100 hem guvenli hem az sayida tur demek. */
const BATCH_SIZE = 100;
const DEFAULT_LIMIT = 200;

interface PendingRow {
  project_id: string;
  source_id: string;
  content: string;
  content_hash: string;
}

/**
 * Bir grup metni gomer. Donen dizi girdiyle AYNI sirada olur.
 *
 * OpenAI cevabi `index` alani tasir ve sirasi garanti degildir; sirayi
 * korumak icin index'e gore yerlestiriyoruz - zip'lemek sessizce yanlis
 * yorumu yanlis vektore baglardi.
 */
async function embedBatch(apiKey: string, inputs: string[]): Promise<number[][]> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
      dimensions: EMBED_DIM,
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`OpenAI ${res.status}: ${detail}`);
  }

  const payload = (await res.json()) as {
    data: Array<{ index: number; embedding: number[] }>;
  };

  const out = new Array<number[]>(inputs.length);
  for (const item of payload.data) out[item.index] = item.embedding;

  const missing = out.findIndex((v) => !v);
  if (missing !== -1) throw new Error(`Embedding eksik dondu: index ${missing}`);

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json(
      { error: "OPENAI_API_KEY tanimli degil - supabase secrets set OPENAI_API_KEY=..." },
      500,
    );
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let limit = DEFAULT_LIMIT;
  try {
    const body = (await req.json()) as { limit?: number };
    if (typeof body?.limit === "number" && body.limit > 0) limit = body.limit;
  } catch {
    // gövdesiz cagri (cron) - varsayilan limit
  }

  const { data: pending, error: pendErr } = await hub.rpc("helm_pending_embeddings", {
    p_limit: limit,
  });
  if (pendErr) return json({ error: pendErr.message }, 500);

  const rows = (pending ?? []) as PendingRow[];
  if (rows.length === 0) {
    return json({ ok: true, pending: 0, embedded: 0, elapsed_ms: Date.now() - startedAt });
  }

  let embedded = 0;
  const errors: string[] = [];

  // Gruplar SIRAYLA gonderiliyor - paralel gondermek ayni saglayiciya es
  // zamanli vurmak demek ve OpenAI kota hatasi dondurur. helm-ingest'teki
  // "ayni saglayici seri" kurali burada da gecerli.
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      const vectors = await embedBatch(apiKey, chunk.map((r) => r.content));

      const payload = chunk.map((row, idx) => ({
        project_id: row.project_id,
        source_kind: "review",
        source_id: row.source_id,
        content: row.content,
        content_hash: row.content_hash,
        embedding: JSON.stringify(vectors[idx]),
        model: EMBED_MODEL,
        updated_at: new Date().toISOString(),
      }));

      const { error: upErr } = await hub
        .from("content_embeddings")
        .upsert(payload, { onConflict: "source_kind,source_id" });
      if (upErr) throw new Error(upErr.message);

      embedded += chunk.length;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const elapsedMs = Date.now() - startedAt;

  await hub.from("audit_log").insert({
    project_id: null,
    target_user: null,
    action: "system.embed_content",
    detail: JSON.stringify({
      pending: rows.length,
      embedded,
      errors,
      model: EMBED_MODEL,
      elapsed_ms: elapsedMs,
    }),
    actor_email: "system",
  });

  return json({
    ok: errors.length === 0,
    pending: rows.length,
    embedded,
    errors,
    model: EMBED_MODEL,
    elapsed_ms: elapsedMs,
  });
});
