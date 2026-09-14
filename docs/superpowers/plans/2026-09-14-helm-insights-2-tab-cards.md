# Helm öneri motoru - Faz 2: Sekme kartları - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her sekmenin (Özet, Gelir, Kullanıcı, Sosyal) hero'sunun altında o sekmenin en önemli açık önerisini tek kart olarak göstermek; "Sonra" ve "Geç" ile durum değiştirmek.

**Architecture:** `@helm/api` insights okuma ve RPC fonksiyonlarını ve saf yardımcıları taşır; `@helm/queries` query key'lerini ve seçeneklerini; mobil `use-insights.ts` hook'larını (iyimser durum güncellemesiyle). `InsightSlot` veriyi okur ve `InsightCard`'ı çizer; dört sekme ekranına tek satırla eklenir.

**Tech Stack:** Expo SDK 57, expo-router 57, TanStack Query v5, Reanimated, NativeWind v4, `@supabase/supabase-js` v2, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-09-14-helm-insights-design.md` (§4)

**Önkoşul:** Faz 1 (migration 0055 uygulanmış). Kart için en az bir başarılı koşu gerekir; yoksa kart çizilmez (beklenen).

## Global Constraints

- Sekme başına 1 kart: en yüksek önem, sonra en yeni. Son başarılı koşu 36 saatten eskiyse ya da öneri yoksa kart çizilmez.
- Kapsam proje seçiciye uyar: seçili proje → o proje + portföy geneli (`project_id is null`).
- Dil: `usePreferences().language`, metin `text[language]`.
- Önem sol şerit değil, önem renginde mono tür etiketi. Accent yalnız birincil aksiyonda.
- Hareket: giriş `Rise` (260ms `EASE_OUT`); çıkış 180ms fade; alttaki içerik 220ms `EASE_IN_OUT`; azaltılmış harekette 160ms fade, hareket yok; sekme değişiminde animasyon yok.
- Hata toast değil satır içi (mobil `CLAUDE.md` §10).
- "Sonra" = 3 gün erteleme. "Geç" = `dismissed`.
- Bu fazda karta dokunma ve "+N öneri daha" YOK; AI sayfası Faz 3'te bağlanır. Çalışmayan etkileşim çizilmez.
- i18n: yeni anahtar eklemeden önce `grep -c '^  "<anahtar>":' apps/mobile/src/lib/i18n.ts` ile çakışma kontrolü ("Ara" = Aralık dersi).
- Commit: tek satır `type(scope): WES-000 mesaj`, `--no-verify` yok, Co-Authored-By yok.
- Spec'ten sapma: sekme sorgusu `limit 3` yerine `limit 10` (Faz 3'te "+N öneri daha" sayısı için; sekme başı üst sınır 3 proje × 3 = 9).

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `packages/api/src/insights.ts` | Tipler, saf yardımcılar, fetch/RPC |
| `packages/api/src/insights.test.ts` | Saf yardımcı testleri |
| `packages/api/src/index.ts` | Export |
| `packages/queries/src/insights.ts` | Key'ler ve queryOptions |
| `packages/queries/src/index.ts` | Export |
| `apps/mobile/src/hooks/use-insights.ts` | Query + iyimser mutation hook'ları |
| `apps/mobile/src/components/bento/rise.tsx` | Yeniden yerleşim geçişi |
| `apps/mobile/src/components/insights/insight-card.tsx` | Kart (compact/full) |
| `apps/mobile/src/components/insights/insight-slot.tsx` | Sekme ekranına tek satırlık giriş |
| `apps/mobile/src/components/insights/index.ts` | Barrel |
| `apps/mobile/src/lib/i18n.ts` | EN karşılıklar |
| Dört sekme ekranı | Slot ekleme |

---

### Task 1: API katmanı ve saf yardımcılar

**Files:**
- Create: `packages/api/src/insights.ts`
- Test: `packages/api/src/insights.test.ts`
- Modify: `packages/api/src/index.ts`

**Interfaces:**
- Produces:
  - Tipler: `InsightTab`, `InsightKind`, `InsightSeverity`, `InsightStatus`, `InsightText`, `InsightEvidence`, `InsightRoute`, `InsightAction`, `Insight`, `InsightRun`, `InsightLanguage`
  - `sortInsights(items: readonly Insight[]): Insight[]`
  - `insightText(insight: Insight, lang: InsightLanguage): InsightText`
  - `isRunFresh(run: InsightRun | null, now: Date, maxHours?: number): boolean`
  - `fetchInsights(client, opts: { propertyId: SelectedPropertyId; tab?: InsightTab; archived: boolean; limit: number }): Promise<Insight[]>`
  - `fetchInsightById(client, id: string): Promise<Insight | null>`
  - `fetchLatestInsightRun(client): Promise<InsightRun | null>`
  - `fetchInsightMonthCost(client, today: string): Promise<number>`
  - `setInsightStatus(client, id: string, status: "seen" | "done" | "dismissed" | "snoozed", snoozeUntil?: string): Promise<void>`

- [ ] **Step 1: Başarısız testi yaz**

`packages/api/src/insights.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { insightText, isRunFresh, sortInsights, type Insight, type InsightRun } from "./insights";

// Sentetik veri - gercek oneri metni/proje yok (repo public).
const insight = (id: string, extra: Partial<Insight> = {}): Insight => ({
  id,
  project_id: null,
  tab: "overview",
  kind: "risk",
  severity: "warn",
  text: { tr: { title: `T-${id}`, body: "g" }, en: { title: `E-${id}`, body: "b" } },
  evidence: [],
  action: null,
  status: "new",
  snoozed_until: null,
  created_at: "2026-03-01T08:00:00Z",
  updated_at: "2026-03-01T08:00:00Z",
  ...extra,
});

describe("sortInsights", () => {
  it("once onem, sonra en yeni", () => {
    const out = sortInsights([
      insight("a", { severity: "info", updated_at: "2026-03-03T00:00:00Z" }),
      insight("b", { severity: "critical", updated_at: "2026-03-01T00:00:00Z" }),
      insight("c", { severity: "critical", updated_at: "2026-03-02T00:00:00Z" }),
    ]);
    expect(out.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("girdiyi degistirmez", () => {
    const xs = [insight("a", { severity: "info" }), insight("b", { severity: "critical" })];
    sortInsights(xs);
    expect(xs.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("insightText", () => {
  it("dile gore metin", () => {
    expect(insightText(insight("x"), "en").title).toBe("E-x");
    expect(insightText(insight("x"), "tr").title).toBe("T-x");
  });

  it("dil eksikse tr'ye duser", () => {
    const i = insight("x", { text: { tr: { title: "T", body: "" } } as Insight["text"] });
    expect(insightText(i, "en").title).toBe("T");
  });
});

describe("isRunFresh", () => {
  const run = (extra: Partial<InsightRun>): InsightRun => ({
    run_date: "2026-03-01",
    status: "ok",
    finished_at: "2026-03-01T05:10:00Z",
    insight_count: 2,
    cost_usd: 0.2,
    ...extra,
  });
  const now = new Date("2026-03-02T10:00:00Z");

  it("36 saat icindeki basarili kosu taze", () => {
    expect(isRunFresh(run({}), now)).toBe(true);
  });

  it("36 saatten eski ya da basarisiz kosu taze degil", () => {
    expect(isRunFresh(run({ finished_at: "2026-02-28T05:00:00Z" }), now)).toBe(false);
    expect(isRunFresh(run({ status: "failed" }), now)).toBe(false);
    expect(isRunFresh(null, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `cd packages/api && bun test src/insights.test.ts`
Expected: FAIL, `Cannot find module './insights'`

- [ ] **Step 3: `insights.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

// Oneri motoru okuma katmani. Yazma tek yol: helm_insight_set_status RPC'si
// (migration 0055). Satirlari packages/insights gunluk isi uretir.

export type InsightTab = "overview" | "revenue" | "users" | "social";
export type InsightKind = "risk" | "opportunity" | "anomaly" | "data_gap";
export type InsightSeverity = "critical" | "warn" | "info";
export type InsightStatus = "new" | "seen" | "done" | "dismissed" | "snoozed";
export type InsightRoute = "overview" | "revenue" | "users" | "social" | "health";
export type InsightLanguage = "tr" | "en";

export interface InsightText {
  title: string;
  body: string;
}

export interface InsightEvidence {
  signal_id: string;
  metric: string;
  window: string;
  value: number;
  baseline: number;
  delta_pct: number | null;
}

export interface InsightAction {
  type: "open_route" | "check_version";
  params: { route: InsightRoute };
}

export interface Insight {
  id: string;
  project_id: string | null;
  tab: InsightTab;
  kind: InsightKind;
  severity: InsightSeverity;
  text: Record<InsightLanguage, InsightText>;
  evidence: InsightEvidence[];
  action: InsightAction | null;
  status: InsightStatus;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsightRun {
  run_date: string;
  status: "running" | "ok" | "failed" | "skipped_budget";
  finished_at: string | null;
  insight_count: number;
  cost_usd: number;
}

const INSIGHT_COLUMNS =
  "id, project_id, tab, kind, severity, text, evidence, action, status, snoozed_until, created_at, updated_at";
const RUN_COLUMNS = "run_date, status, finished_at, insight_count, cost_usd";

const SEVERITY_RANK: Record<InsightSeverity, number> = { critical: 0, warn: 1, info: 2 };

/** Onem, sonra en yeni. Time: O(n log n); Space: O(n). Girdi degismez. */
export function sortInsights(items: readonly Insight[]): Insight[] {
  return [...items].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      Date.parse(b.updated_at) - Date.parse(a.updated_at),
  );
}

export function insightText(insight: Insight, lang: InsightLanguage): InsightText {
  return insight.text[lang] ?? insight.text.tr;
}

/** Bayat oneri gostermemek icin: son BASARILI kosu maxHours icinde olmali. */
export function isRunFresh(run: InsightRun | null, now: Date, maxHours = 36): boolean {
  if (run == null || run.status !== "ok" || run.finished_at == null) return false;
  return now.getTime() - Date.parse(run.finished_at) <= maxHours * 3_600_000;
}

export async function fetchInsights(
  client: SupabaseClient,
  opts: { propertyId: SelectedPropertyId; tab?: InsightTab; archived: boolean; limit: number },
): Promise<Insight[]> {
  let q = client
    .from("insights")
    .select(INSIGHT_COLUMNS)
    .in("status", opts.archived ? ["done", "dismissed"] : ["new", "seen"])
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  if (opts.tab) q = q.eq("tab", opts.tab);
  // Secili proje + portfoy geneli (project_id null) birlikte.
  if (opts.propertyId !== "all") q = q.or(`project_id.eq.${opts.propertyId},project_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Insight[];
  return opts.archived ? rows : sortInsights(rows);
}

export async function fetchInsightById(client: SupabaseClient, id: string): Promise<Insight | null> {
  const { data, error } = await client.from("insights").select(INSIGHT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Insight | null) ?? null;
}

export async function fetchLatestInsightRun(client: SupabaseClient): Promise<InsightRun | null> {
  const { data, error } = await client
    .from("insight_runs")
    .select(RUN_COLUMNS)
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data == null ? null : { ...(data as InsightRun), cost_usd: Number((data as InsightRun).cost_usd) };
}

/** Bu ayin toplam maliyeti. Ayda en fazla 31 satir: O(r). */
export async function fetchInsightMonthCost(client: SupabaseClient, today: string): Promise<number> {
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data, error } = await client.from("insight_runs").select("cost_usd").gte("run_date", monthStart);
  if (error) throw error;
  let total = 0;
  for (const row of (data ?? []) as Array<{ cost_usd: number | string }>) total += Number(row.cost_usd);
  return total;
}

export async function setInsightStatus(
  client: SupabaseClient,
  id: string,
  status: "seen" | "done" | "dismissed" | "snoozed",
  snoozeUntil?: string,
): Promise<void> {
  const { error } = await client.rpc("helm_insight_set_status", {
    p_id: id,
    p_status: status,
    p_snooze_until: snoozeUntil ?? null,
  });
  if (error) throw error;
}
```

`packages/api/src/index.ts` sonuna:
```ts
export * from "./insights";
```

- [ ] **Step 4: Testler + typecheck**

Run: `cd packages/api && bun test && bun run typecheck`
Expected: PASS, çıkış kodu 0

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/insights.ts packages/api/src/insights.test.ts packages/api/src/index.ts
git commit -m "feat(api): WES-000 oneri okuma katmani, durum rpc'si ve saf yardimcilari ekle"
```

---

### Task 2: Query seçenekleri ve mobil hook'lar

**Files:**
- Create: `packages/queries/src/insights.ts`
- Modify: `packages/queries/src/index.ts`
- Create: `apps/mobile/src/hooks/use-insights.ts`

**Interfaces:**
- Consumes: Task 1 fonksiyonları ve tipleri
- Produces:
  - `insightsKeys` (`all`, `lists()`, `list(opts)`, `detail(id)`, `latestRun()`, `monthCost(month)`)
  - `insightsQueryOptions(client, opts)`, `insightQueryOptions(client, id)`, `latestInsightRunQueryOptions(client)`, `insightMonthCostQueryOptions(client, today)`
  - Mobil: `useInsights(tab: InsightTab)`, `useInsightFeed(tab: InsightTab | "all", archived: boolean)`, `useInsight(id: string)`, `useLatestInsightRun()`, `useInsightMonthCost()`, `useSetInsightStatus()` - mutate değişkeni `{ id: string; status: "seen" | "done" | "dismissed" | "snoozed"; snoozeUntil?: string }`

- [ ] **Step 1: `packages/queries/src/insights.ts`**

```ts
import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import {
  fetchInsightById,
  fetchInsightMonthCost,
  fetchInsights,
  fetchLatestInsightRun,
  type InsightTab,
} from "@helm/api";

type ListOpts = { propertyId: SelectedPropertyId; tab?: InsightTab; archived: boolean; limit: number };

export const insightsKeys = {
  all: ["insights"] as const,
  lists: () => ["insights", "list"] as const,
  list: (o: ListOpts) => ["insights", "list", o.propertyId, o.tab ?? "all", o.archived, o.limit] as const,
  detail: (id: string) => ["insights", "detail", id] as const,
  latestRun: () => ["insights", "run", "latest"] as const,
  monthCost: (month: string) => ["insights", "run", "cost", month] as const,
};

/** Veri gunde bir degisir: 5 dk bayatlik yeter. */
const STALE = 5 * 60_000;

export function insightsQueryOptions(client: SupabaseClient, opts: ListOpts) {
  return queryOptions({ queryKey: insightsKeys.list(opts), queryFn: () => fetchInsights(client, opts), staleTime: STALE });
}

export function insightQueryOptions(client: SupabaseClient, id: string) {
  return queryOptions({ queryKey: insightsKeys.detail(id), queryFn: () => fetchInsightById(client, id), staleTime: STALE });
}

export function latestInsightRunQueryOptions(client: SupabaseClient) {
  return queryOptions({ queryKey: insightsKeys.latestRun(), queryFn: () => fetchLatestInsightRun(client), staleTime: STALE });
}

export function insightMonthCostQueryOptions(client: SupabaseClient, today: string) {
  return queryOptions({
    queryKey: insightsKeys.monthCost(today.slice(0, 7)),
    queryFn: () => fetchInsightMonthCost(client, today),
    staleTime: STALE,
  });
}
```

`packages/queries/src/index.ts` sonuna:
```ts
export * from "./insights";
```

- [ ] **Step 2: `apps/mobile/src/hooks/use-insights.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  insightMonthCostQueryOptions,
  insightQueryOptions,
  insightsKeys,
  insightsQueryOptions,
  latestInsightRunQueryOptions,
} from "@helm/queries";
import { setInsightStatus, type Insight, type InsightTab } from "@helm/api";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { Insight, InsightTab, InsightRun } from "@helm/api";

/** Sekme karti: tek kart + Faz 3'teki "+N" sayisi icin 10 satir yeter. */
export function useInsights(tab: InsightTab) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(insightsQueryOptions(supabase, { propertyId: selectedPropertyId, tab, archived: false, limit: 10 }));
}

export function useInsightFeed(tab: InsightTab | "all", archived: boolean) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(
    insightsQueryOptions(supabase, {
      propertyId: selectedPropertyId,
      ...(tab === "all" ? {} : { tab }),
      archived,
      limit: 50,
    }),
  );
}

export function useInsight(id: string) {
  return useQuery(insightQueryOptions(supabase, id));
}

export function useLatestInsightRun() {
  return useQuery(latestInsightRunQueryOptions(supabase));
}

export function useInsightMonthCost() {
  return useQuery(insightMonthCostQueryOptions(supabase, new Date().toISOString().slice(0, 10)));
}

type StatusVars = { id: string; status: "seen" | "done" | "dismissed" | "snoozed"; snoozeUntil?: string };

/**
 * Iyimser: kart hemen kaybolur. Yazma basarisizsa listeler geri yuklenir ve
 * cagiran `error` ile satir ici mesaj gosterir (toast yok, CLAUDE.md §10).
 * `seen` listeden kaldirmaz - yalniz durum degisir.
 */
export function useSetInsightStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: StatusVars) => setInsightStatus(supabase, v.id, v.status, v.snoozeUntil),
    onMutate: async (v: StatusVars) => {
      await qc.cancelQueries({ queryKey: insightsKeys.lists() });
      const snapshot = qc.getQueriesData<Insight[]>({ queryKey: insightsKeys.lists() });
      if (v.status !== "seen") {
        qc.setQueriesData<Insight[]>({ queryKey: insightsKeys.lists() }, (old) =>
          old?.filter((i) => i.id !== v.id),
        );
      }
      return { snapshot };
    },
    onError: (_err, _v, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: insightsKeys.all });
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/canakyuz/Developer/wesan/platform/helm && bun run typecheck`
Expected: tüm workspace'ler çıkış kodu 0

- [ ] **Step 4: Commit**

```bash
git add packages/queries/src/insights.ts packages/queries/src/index.ts apps/mobile/src/hooks/use-insights.ts
git commit -m "feat(mobile): WES-000 oneri query secenekleri ve iyimser durum hook'larini ekle"
```

---

### Task 3: Yeniden yerleşim geçişi, kart ve slot

**Files:**
- Modify: `apps/mobile/src/components/bento/rise.tsx`
- Create: `apps/mobile/src/components/insights/insight-card.tsx`
- Create: `apps/mobile/src/components/insights/insight-slot.tsx`
- Create: `apps/mobile/src/components/insights/index.ts`
- Modify: `apps/mobile/src/lib/i18n.ts`

**Interfaces:**
- Consumes: Task 2 hook'ları; `SEVERITY_COLOR(theme, severity)` (`~/components/overview`, `AlertSeverity = "info" | "warn" | "critical"`); `Pill({label, background, color, onPress})`; `BentoTile({children, padding?, onPress?, style?})`; `Rise({children, index?, replayKey?, style?})`; `formatDelta(value: number, decimals = 1): string` (`~/lib/format`)
- Produces:
  - `InsightCard(props: { insight: Insight; variant: "compact" | "full"; projectName: string | null; onAction: ((route: InsightRoute) => void) | null; onSnooze: () => void; onDismiss: () => void; onOpen?: () => void; moreCount?: number; onMore?: () => void; error: string | null })`
  - `InsightSlot(props: { tab: InsightTab; riseIndex: number; replayKey: number })`
  - `ROUTE_HREF: Record<InsightRoute, Href>`

- [ ] **Step 1: Tasarım skill'lerini yükle (mobil CLAUDE.md zorunlu)**

`Skill` ile `impeccable`, `emil-design-eng`, `design-taste-frontend` çağır. Çelişkide `apps/mobile/design.md` kazanır.

- [ ] **Step 2: `EASE_IN_OUT` export kontrolü**

Run: `grep -n "EASE_IN_OUT" packages/design/src/index.ts packages/design/src/motion.ts`
Expected: `motion.ts` içinde `export const EASE_IN_OUT`. `index.ts` `export * from "./motion"` içermiyorsa ekle:
```ts
export * from "./motion";
```

- [ ] **Step 3: `rise.tsx` - yeniden yerleşim**

`Animated` import satırına `Easing` ve `LinearTransition` ekle ve `EASE_IN_OUT`'u `@helm/design`'dan al. Dönüş satırını değiştir:

Eski:
```tsx
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
```
Yeni:
```tsx
  // Ustteki bir kart (oneri) kapaninca alttaki tile'lar ziplamasin: 220ms kayma.
  // Azaltilmis harekette gecis yok - icerik aninda yerine oturur.
  const reflow = noMotion
    ? undefined
    : LinearTransition.duration(REFLOW_MS).easing(Easing.bezier(...EASE_IN_OUT));
  return (
    <Animated.View layout={reflow} style={[style, animated]}>
      {children}
    </Animated.View>
  );
```
Dosya üst seviyesine:
```tsx
/** Yeniden yerlesim suresi - cikis (180ms) sonrasi kayma. */
const REFLOW_MS = 220;
```

- [ ] **Step 4: i18n çakışma kontrolü ve anahtarlar**

Run:
```bash
cd apps/mobile && for k in "RİSK" "FIRSAT" "ANOMALİ" "VERİ EKSİK" "Sonra" "Geç" "Özeti aç" "Geliri aç" "Kullanıcıları aç" "Sosyali aç" "Sağlığı aç" "Öneri güncellenemedi" "+{n} öneri daha"; do printf '%s=%s\n' "$k" "$(grep -c "^  \"$k\":" src/lib/i18n.ts)"; done
```
Expected: hepsi `0`. Değilse o anahtar zaten başka anlamda kullanılıyor: yeni metni farklı yaz (örn. "Geç" doluysa "Atla").

`src/lib/i18n.ts` içindeki `// Ara sekmesi ve proje secici` bloğunun altına:
```ts
  // Oneri kartlari
  "RİSK": "RISK",
  "FIRSAT": "OPPORTUNITY",
  "ANOMALİ": "ANOMALY",
  "VERİ EKSİK": "DATA GAP",
  "Sonra": "Later",
  "Geç": "Skip",
  "Özeti aç": "Open overview",
  "Geliri aç": "Open revenue",
  "Kullanıcıları aç": "Open users",
  "Sosyali aç": "Open social",
  "Sağlığı aç": "Open health",
  "Öneri güncellenemedi": "Couldn't update the insight",
  "+{n} öneri daha": "+{n} more insights",
```

- [ ] **Step 5: `insight-card.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";
import type { Href } from "expo-router";
import { press, space } from "@helm/design";
import { insightText, type Insight, type InsightKind, type InsightRoute } from "@helm/api";

import { BentoTile } from "~/components/bento";
import { Pill, SEVERITY_COLOR } from "~/components/overview";
import { formatDelta } from "~/lib/format";
import { useT } from "~/lib/i18n";
import { usePreferences } from "~/lib/preferences";
import { useTheme } from "~/theme/use-theme";

const KIND_LABEL: Record<InsightKind, string> = {
  risk: "RİSK",
  opportunity: "FIRSAT",
  anomaly: "ANOMALİ",
  data_gap: "VERİ EKSİK",
};

const ACTION_LABEL: Record<InsightRoute, string> = {
  overview: "Özeti aç",
  revenue: "Geliri aç",
  users: "Kullanıcıları aç",
  social: "Sosyali aç",
  health: "Sağlığı aç",
};

export const ROUTE_HREF: Record<InsightRoute, Href> = {
  overview: "/(cockpit)/(tabs)/overview",
  revenue: "/(cockpit)/(tabs)/revenue",
  users: "/(cockpit)/(tabs)/analytics",
  social: "/(cockpit)/(tabs)/social",
  health: "/(cockpit)/health",
};

/** "dau -60.0% · 7d/28d". Rakamlar kanittan (koddan), Claude'dan degil. */
function evidenceLine(e: Insight["evidence"][number]): string {
  const change = e.delta_pct != null ? formatDelta(e.delta_pct) : `${e.value} / ${e.baseline}`;
  return `${e.metric} ${change} · ${e.window}`;
}

type Props = {
  insight: Insight;
  variant: "compact" | "full";
  projectName: string | null;
  onAction: ((route: InsightRoute) => void) | null;
  onSnooze: () => void;
  onDismiss: () => void;
  onOpen?: () => void;
  moreCount?: number;
  onMore?: () => void;
  error: string | null;
};

/**
 * Oneri karti. Onem SOL SERIT DEGIL: onem renginde mono tur etiketi
 * (AttentionTile'daki 2px seridi yeni bilesene tasimiyoruz). Accent yalniz
 * birincil aksiyonda.
 */
export function InsightCard({
  insight, variant, projectName, onAction, onSnooze, onDismiss, onOpen, moreCount = 0, onMore, error,
}: Props) {
  const t = useT();
  const { theme } = useTheme();
  const { language } = usePreferences();
  const text = insightText(insight, language);
  const full = variant === "full";
  const evidence = full ? insight.evidence : insight.evidence.slice(0, 1);
  const route = insight.action?.params.route ?? null;

  return (
    <BentoTile>
      <Pressable
        disabled={onOpen == null}
        onPress={onOpen}
        accessibilityRole={onOpen ? "button" : undefined}
        accessibilityLabel={`${t(KIND_LABEL[insight.kind])}. ${text.title}`}
      >
        {({ pressed }) => (
          <View style={pressed ? { opacity: press.opacity } : undefined}>
            <View className="flex-row items-center justify-between">
              <Text
                className="font-mono-medium text-eyebrow tracking-wide"
                style={{ color: SEVERITY_COLOR(theme, insight.severity) }}
              >
                {t(KIND_LABEL[insight.kind])}
              </Text>
              {projectName != null ? (
                <Text className="font-mono-medium text-eyebrow text-fg3" numberOfLines={1}>
                  {projectName}
                </Text>
              ) : null}
            </View>
            <Text className="mt-xs font-semibold text-emph tracking-tight text-fg">{text.title}</Text>
            <Text className="mt-[3px] text-meta leading-[18px] text-fg2" numberOfLines={full ? undefined : 2}>
              {text.body}
            </Text>
            {evidence.map((e) => (
              <Text key={e.signal_id} className="mt-xs font-mono-medium text-[11px] text-fg3" numberOfLines={1}>
                {evidenceLine(e)}
              </Text>
            ))}
          </View>
        )}
      </Pressable>

      <View className="mt-headerY flex-row flex-wrap gap-sm">
        {route != null && onAction != null ? (
          <Pill label={t(ACTION_LABEL[route])} background={theme.accent} color={theme.accentInk} onPress={() => onAction(route)} />
        ) : null}
        <Pill label={t("Sonra")} background={theme.tile2} color={theme.fg} onPress={onSnooze} />
        <Pill label={t("Geç")} background={theme.tile2} color={theme.fg} onPress={onDismiss} />
      </View>

      {error != null ? (
        <Text className="mt-sm text-meta" style={{ color: theme.neg }}>
          {error}
        </Text>
      ) : null}

      {moreCount > 0 && onMore != null ? (
        <Pressable onPress={onMore} accessibilityRole="button" className="mt-headerY" hitSlop={space.sm}>
          <Text className="font-mono-medium text-eyebrow tracking-wide text-fg2">
            {t("+{n} öneri daha", { n: moreCount })} ›
          </Text>
        </Pressable>
      ) : null}
    </BentoTile>
  );
}
```

- [ ] **Step 6: `insight-slot.tsx`**

```tsx
import { useMemo } from "react";
import Animated, { FadeOut, useReducedMotion } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { reduced } from "@helm/design";
import { isRunFresh, type InsightTab } from "@helm/api";

import { Rise } from "~/components/bento";
import { useInsights, useLatestInsightRun, useSetInsightStatus } from "~/hooks/use-insights";
import { useProperties } from "~/hooks/use-properties";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { InsightCard, ROUTE_HREF } from "./insight-card";

/** Cikis girise gore hizli: sistem cevap veriyor, kullanici karar vermis. */
const EXIT_MS = 180;
const SNOOZE_DAYS = 3;

type Props = { tab: InsightTab; riseIndex: number; replayKey: number };

/**
 * Sekme ekranina tek satir: o sekmenin en onemli acik onerisi.
 * Bos ya da bayat (36 saat) ise HICBIR SEY cizilmez - "bir sey yok" kutusu yer kaplar, bilgi vermez.
 */
export function InsightSlot({ tab, riseIndex, replayKey }: Props) {
  const t = useT();
  const router = useRouter();
  const noMotion = useReducedMotion();
  const insights = useInsights(tab);
  const run = useLatestInsightRun();
  const properties = useProperties();
  const setStatus = useSetInsightStatus();

  // Time: O(p) Map kurulumu, kart basina O(1) okuma.
  const names = useMemo(() => new Map((properties.data ?? []).map((p) => [p.id, p.name])), [properties.data]);

  const top = insights.data?.[0];
  if (top == null || !isRunFresh(run.data ?? null, new Date())) return null;

  const change = (status: "dismissed" | "snoozed") => {
    haptic.tap();
    const snoozeUntil =
      status === "snoozed" ? new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString() : undefined;
    setStatus.mutate({ id: top.id, status, ...(snoozeUntil ? { snoozeUntil } : {}) });
  };

  return (
    <Animated.View key={top.id} exiting={FadeOut.duration(noMotion ? reduced.fade : EXIT_MS)}>
      <Rise index={riseIndex} replayKey={replayKey}>
        <InsightCard
          insight={top}
          variant="compact"
          projectName={top.project_id != null ? (names.get(top.project_id) ?? null) : null}
          onAction={(route) => {
            haptic.tap();
            router.navigate(ROUTE_HREF[route]);
          }}
          onSnooze={() => change("snoozed")}
          onDismiss={() => change("dismissed")}
          error={setStatus.isError && setStatus.variables?.id === top.id ? t("Öneri güncellenemedi") : null}
        />
      </Rise>
    </Animated.View>
  );
}
```

`apps/mobile/src/components/insights/index.ts`:
```ts
export { InsightCard, ROUTE_HREF } from "./insight-card";
export { InsightSlot } from "./insight-slot";
```

- [ ] **Step 7: Typecheck**

Run: `cd apps/mobile && bun run typecheck`
Expected: çıkış kodu 0. `space.sm` `hitSlop` tipinde sayı değilse `hitSlop={8}` yaz.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/bento/rise.tsx apps/mobile/src/components/insights apps/mobile/src/lib/i18n.ts packages/design/src/index.ts
git commit -m "feat(mobile): WES-000 oneri karti, sekme slotu ve tile yeniden yerlesim gecisini ekle"
```

---

### Task 4: Dört sekmeye yerleştirme ve simülatör doğrulaması

**Files:**
- Modify: `apps/mobile/app/(cockpit)/(tabs)/overview.tsx`
- Modify: `apps/mobile/app/(cockpit)/(tabs)/revenue.tsx`
- Modify: `apps/mobile/app/(cockpit)/(tabs)/analytics.tsx`
- Modify: `apps/mobile/app/(cockpit)/(tabs)/social/index.tsx`

**Interfaces:**
- Consumes: `InsightSlot` (Task 3)

- [ ] **Step 1: Import (dört dosyada)**

Her dosyanın `~/components/...` import grubuna:
```tsx
import { InsightSlot } from "~/components/insights";
```

- [ ] **Step 2: Özet - stat satırının altı**

`overview.tsx` içinde:
```tsx
          </View>

          {/* Aylik hedef */}
```
şununla değiştir:
```tsx
          </View>

          <InsightSlot tab="overview" riseIndex={4} replayKey={replayKey} />

          {/* Aylik hedef */}
```

- [ ] **Step 3: Gelir - hero'nun altı**

`revenue.tsx` içinde:
```tsx
          {/* Donem gezinmesi - yatay kaydirmali, en guncel solda */}
```
satırının hemen önüne:
```tsx
          <InsightSlot tab="revenue" riseIndex={1} replayKey={replayKey} />

```

- [ ] **Step 4: Kullanıcı - hero'nun altı**

`analytics.tsx:178` satırında başlayan `<Rise index={0} replayKey={replayKey}>` bloğunun kapanan `</Rise>` satırının hemen altına (hero `BentoTile`'ı `analytics.tsx:231` civarında kapanır):
```tsx

          <InsightSlot tab="users" riseIndex={1} replayKey={replayKey} />
```

- [ ] **Step 5: Sosyal - segment satırının altı**

`social/index.tsx` içinde:
```tsx
          />
        </View>

        {tab === 0 ? <LibraryView /> : tab === 1 ? <QueueView /> : <AccountsView onRefresh={onRefresh} refreshing={refreshing} />}
```
şununla değiştir:
```tsx
          />
        </View>

        {/* Liste kaplarinin DISINDA: FlatList/SectionList kaydirma kabina girmesin. */}
        <View className="px-screenX pb-sm">
          <InsightSlot tab="social" riseIndex={0} replayKey={0} />
        </View>

        {tab === 0 ? <LibraryView /> : tab === 1 ? <QueueView /> : <AccountsView onRefresh={onRefresh} refreshing={refreshing} />}
```

- [ ] **Step 6: Typecheck + testler**

Run: `cd /Users/canakyuz/Developer/wesan/platform/helm && bun run typecheck && (cd apps/mobile && bun test) && (cd packages/api && bun test)`
Expected: hepsi çıkış kodu 0

- [ ] **Step 7: Simülatör doğrulaması**

Metro'yu `.claude/launch.json` içindeki `mobile-metro` ile başlat (Bash ile değil). Uygulamayı yeniden aç:
```bash
xcrun simctl terminate booted com.canakyuz.helmmobile; xcrun simctl openurl booted "com.canakyuz.helmmobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```
Kontrol:
1. Faz 1 en az bir kez başarıyla koştuysa ve açık öneri varsa: Özet'te stat satırının altında kart; tür etiketi önem renginde; kanıt satırı mono.
2. Açık öneri yoksa: kart yok, ekran önceki gibi (beklenen).
3. "Geç": kart 180ms'de solar, alttaki "Aylık hedef" 220ms'de yukarı kayar; Metro logunda hata yok.
4. Test satırı eklemek gerekirse **DB'ye yazmadan önce kullanıcıya sor** (gerçek veritabanı).

Ekran görüntüsü: `xcrun simctl io booted screenshot <scratchpad>/insight-card.png`

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(cockpit)/(tabs)/overview.tsx" "apps/mobile/app/(cockpit)/(tabs)/revenue.tsx" "apps/mobile/app/(cockpit)/(tabs)/analytics.tsx" "apps/mobile/app/(cockpit)/(tabs)/social/index.tsx"
git commit -m "feat(mobile): WES-000 dort sekmeye oneri kartini ekle"
```

---

## Self-Review (yazar)

- Spec §4 yer (hero altı) → Task 4; sekme başına 1 kart, bayatlık 36 saat, boşta çizilmez → Task 1 `isRunFresh` + Task 3 slot.
- Kapsam (seçili proje + portföy) → Task 1 `fetchInsights` `or(...)`.
- Anatomi, dil, önem etiketi, accent → Task 3 kart.
- "Sonra" 3 gün / "Geç" dismissed, iyimser + satır içi hata → Task 2 mutation + Task 3 slot.
- Hareket tablosu → Task 3 (`EXIT_MS`, `REFLOW_MS`, `reduced.fade`); sekme değişimi animasyonsuz mevcut `replayOn` ile korunur.
- Gövdeye dokunma ve "+N öneri daha" bilinçli olarak Faz 3'te (`onOpen`, `onMore` prop'ları hazır).
