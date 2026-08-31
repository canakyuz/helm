#!/usr/bin/env bun
// packages/mcp/src/index.ts
// Helm MCP sunucusu - portfoy verisini bir asistana arac olarak acar.
//
// Tasima: stdio. BU YUZDEN stdout'a ASLA yazma - orasi protokol kanali,
// tek bir console.log oturumu bozar. Gunluk icin console.error (stderr).
//
// Kurulum (Claude Code / Claude Desktop):
//   {
//     "mcpServers": {
//       "helm": {
//         "command": "bun",
//         "args": ["run", "/mutlak/yol/helm/packages/mcp/src/index.ts"],
//         "env": { "HELM_SUPABASE_URL": "...", "HELM_SUPABASE_KEY": "..." }
//       }
//     }
//   }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createHubClient, toolError, toolJson } from "./client.js";

const hub = await createHubClient();

const server = new McpServer({
  name: "helm",
  version: "0.1.0",
});

/** "all" ya da property id - Helm'in her yerinde ayni kapsam sozlesmesi. */
const scopeArg = z
  .string()
  .optional()
  .describe("Property (uygulama) id'si. Bos birakilirsa tum portfoy.");

// ---------------------------------------------------------------------------
// 1) Portfoy envanteri
// ---------------------------------------------------------------------------
server.registerTool(
  "helm_list_apps",
  {
    title: "Uygulamalari listele",
    description:
      "Portfoydeki tum uygulamalari (property) dondurur: id, ad, tur, App Store ve Google Play kimlikleri. " +
      "Diger araclara project_id vermeden once buradan id alinir.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const { data, error } = await hub
      .from("properties")
      .select("id, name, type, app_store_id, google_play_id")
      .order("name");
    if (error) return toolError(error.message);
    return toolJson({ count: data?.length ?? 0, apps: data ?? [] });
  },
);

// ---------------------------------------------------------------------------
// 2) Metrikler
// ---------------------------------------------------------------------------
server.registerTool(
  "helm_metrics",
  {
    title: "Metrikleri getir",
    description:
      "Gunluk metrik toplamlari (mrr, dau, ad_revenue, active_subs, new_users, total_users, errors...). " +
      "Metrik adlarini MUTLAKA belirt - filtresiz cagri gereksiz veri indirir.",
    inputSchema: {
      metrics: z
        .array(z.string())
        .min(1)
        .describe("Istenen metrik adlari, orn. ['mrr','dau']"),
      since: z
        .string()
        .describe("Baslangic tarihi, YYYY-MM-DD biciminde"),
      project_id: scopeArg,
    },
    annotations: { readOnlyHint: true },
  },
  async ({ metrics, since, project_id }) => {
    const { data, error } = await hub.rpc("helm_metric_daily", {
      p_since: since,
      p_metrics: metrics,
      p_project_id: project_id ?? null,
    });
    if (error) return toolError(error.message);
    return toolJson({ rows: data?.length ?? 0, series: data ?? [] });
  },
);

// ---------------------------------------------------------------------------
// 3) Yorum ozeti - bugunku helm_review_stats RPC'si
// ---------------------------------------------------------------------------
server.registerTool(
  "helm_review_stats",
  {
    title: "Yorum puan ozeti",
    description:
      "Ortalama puan, yildiz dagilimi ve iOS/Android kirilimi. Ozet veritabaninda toplanir, " +
      "yani liste tavanindan etkilenmez ve tam veriyi yansitir.",
    inputSchema: { project_id: scopeArg },
    annotations: { readOnlyHint: true },
  },
  async ({ project_id }) => {
    const { data, error } = await hub.rpc("helm_review_stats", {
      p_project_id: project_id ?? null,
    });
    if (error) return toolError(error.message);
    return toolJson({ breakdown: data ?? [] });
  },
);

// ---------------------------------------------------------------------------
// 4) Yorum listesi
// ---------------------------------------------------------------------------
server.registerTool(
  "helm_reviews",
  {
    title: "Yorumlari listele",
    description:
      "Magaza yorumlarini tarihe gore yeniden eskiye dondurur. Kelime eslesmesi icin `search`, " +
      "anlamsal arama icin helm_ask_reviews kullan.",
    inputSchema: {
      project_id: scopeArg,
      source: z.enum(["appstore", "playstore"]).optional(),
      rating: z.number().int().min(1).max(5).optional(),
      search: z.string().optional().describe("Baslik/govde icinde kelime aramasi"),
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ project_id, source, rating, search, limit }) => {
    let q = hub
      .from("reviews")
      .select("id, project_id, source, rating, title, body, territory, app_version, review_date, developer_response")
      .order("review_date", { ascending: false })
      .limit(limit ?? 25);

    if (project_id) q = q.eq("project_id", project_id);
    if (source) q = q.eq("source", source);
    if (rating) q = q.eq("rating", rating);
    if (search) {
      q = q.or(`title.ilike."%${search}%",body.ilike."%${search}%"`);
    }

    const { data, error } = await q;
    if (error) return toolError(error.message);
    return toolJson({ count: data?.length ?? 0, reviews: data ?? [] });
  },
);

// ---------------------------------------------------------------------------
// 5) Anlamsal soru - RAG ucunu cagirir
// ---------------------------------------------------------------------------
server.registerTool(
  "helm_ask_reviews",
  {
    title: "Yorumlara soru sor",
    description:
      "Yorumlara anlamsal arama yapip kaynakli bir cevap dondurur. Kelime eslesmesi yerine anlam " +
      "eslesmesi kullanir: 'performans' sorusu 'cok yavas aciliyor' diyen yorumu da bulur. " +
      "Cevabin icindeki [1], [2] isaretleri donen sources dizisine karsilik gelir.",
    inputSchema: {
      question: z.string().min(3).max(1000),
      project_id: scopeArg,
      limit: z.number().int().min(1).max(50).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ question, project_id, limit }) => {
    const { data, error } = await hub.functions.invoke("helm-ask", {
      body: { question, project_id: project_id ?? null, limit },
    });
    if (error) return toolError(error.message);
    const payload = data as { error?: string };
    if (payload?.error) return toolError(payload.error);
    return toolJson(data);
  },
);

// ---------------------------------------------------------------------------
// 6) Veri sagligi - "sifir gelir mi, susmus kaynak mi"
// ---------------------------------------------------------------------------
server.registerTool(
  "helm_data_health",
  {
    title: "Veri saglik durumu",
    description:
      "Son senkron kosulari ve veri kapsama durumu. Bir metrik sifir gorunuyorsa ONCE buraya bak: " +
      "kaynak susmus olabilir, yani sifir gercek olmayabilir.",
    inputSchema: {
      runs: z.number().int().min(1).max(50).optional().describe("Kac kosu listelensin (varsayilan 5)"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ runs }) => {
    const [{ data: syncRuns, error: runErr }, { data: coverage, error: covErr }] =
      await Promise.all([
        hub
          .from("sync_runs")
          .select("id, started_at, finished_at, trigger, ingested, ok_count, error_count")
          .order("started_at", { ascending: false })
          .limit(runs ?? 5),
        hub.rpc("data_coverage"),
      ]);

    if (runErr) return toolError(runErr.message);
    if (covErr) return toolError(covErr.message);

    return toolJson({ recent_runs: syncRuns ?? [], coverage: coverage ?? null });
  },
);

// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr - stdout protokol kanali.
  console.error("helm-mcp hazir (stdio)");
}

main().catch((err) => {
  console.error("helm-mcp baslatilamadi:", err instanceof Error ? err.message : err);
  process.exit(1);
});
