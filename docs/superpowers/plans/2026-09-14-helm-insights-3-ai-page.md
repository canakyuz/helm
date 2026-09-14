# Helm öneri motoru - Faz 3: AI sayfası - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab bar'daki ayrık arama butonunu AI butonuna çevirmek; açınca günlük analiz durumu, sekme filtreli öneri akışı, arşiv, detay ve (korunan) arama gösteren AI sayfasını kurmak; sekme kartlarını bu sayfaya bağlamak.

**Architecture:** `(tabs)/search` rotası `(tabs)/ai` olur (`role="search"` korunur, ikon `sparkles`). `ai/index.tsx` Faz 2 hook'larıyla akışı çizer; `Stack.SearchBar` yazılınca yerel arama sonuçlarına geçer (index öneri metnini de kapsar). `ai/[id].tsx` detay ve "seen" işaretleme. Faz 2 `InsightSlot` karta dokunma ve "+N öneri daha" ile buraya bağlanır.

**Tech Stack:** Expo SDK 57, expo-router 57 (`NativeTabs`, `Stack.SearchBar`, trigger `accessibilityLabel`), `@expo/ui` (`NativeSegmented`), TanStack Query v5, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-09-14-helm-insights-design.md` (§5)

**Önkoşul:** Faz 2 tamam (`use-insights.ts`, `InsightCard`, `ROUTE_HREF`).

## Global Constraints

- Tab bar'da toplam 5 yuva: 4 sekme + ayrık AI. Yeni sekme eklenmez.
- `role="search"` korunur; `accessibilityLabel="Helm AI"`. VoiceOver'ın ek "arama" niteliği okuyup okumadığı simülatörde doğrulanır ve rapora yazılır.
- Aşama 2 (sohbet) öğeleri çizilmez: "bunu açıkla" butonu, composer, orb yok.
- Onay kartı yok: v1 aksiyonları (`open_route`, `check_version`) yazma yapmaz.
- Segment değişiminde animasyon yok (sık kullanım).
- Boş durumlar spec §5 metinleriyle.
- i18n: yeni anahtardan önce çakışma kontrolü (`grep -c '^  "<anahtar>":'`).
- Commit: tek satır `type(scope): WES-000 mesaj`, `--no-verify` yok, Co-Authored-By yok.

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `apps/mobile/app/(cockpit)/(tabs)/ai/_layout.tsx` | Stack, büyük başlık, detay ekranı kaydı (search'ten taşınır) |
| `apps/mobile/app/(cockpit)/(tabs)/ai/index.tsx` | Durum, segment, akış, arşiv, arama (search'ten taşınır, yeniden yazılır) |
| `apps/mobile/app/(cockpit)/(tabs)/ai/[id].tsx` | Öneri detayı |
| `apps/mobile/app/(cockpit)/(tabs)/_layout.tsx` | Trigger adı/ikon/etiket |
| `apps/mobile/src/lib/search-index.ts` | Öneri metnini aramaya ekleme |
| `apps/mobile/src/lib/__tests__/search-index.test.ts` | Arama testi |
| `apps/mobile/src/lib/insight-status.ts` | Durum satırı metnini seçen saf fonksiyon |
| `apps/mobile/src/lib/__tests__/insight-status.test.ts` | Durum satırı testi |
| `apps/mobile/src/components/insights/insight-slot.tsx` | Karta dokunma ve "+N" bağlantısı |
| `apps/mobile/src/lib/i18n.ts`, `apps/mobile/design.md`, `apps/mobile/CLAUDE.md` | Metin ve doküman |

---

### Task 1: Rotayı AI'a taşı ve tab butonunu değiştir

**Files:**
- Move: `apps/mobile/app/(cockpit)/(tabs)/search/` → `apps/mobile/app/(cockpit)/(tabs)/ai/`
- Modify: `apps/mobile/app/(cockpit)/(tabs)/_layout.tsx`
- Modify: `apps/mobile/app/(cockpit)/(tabs)/ai/_layout.tsx`

- [ ] **Step 1: Taşı**

```bash
cd "apps/mobile/app/(cockpit)/(tabs)" && git mv search ai
```

- [ ] **Step 2: Trigger'ı değiştir**

`(tabs)/_layout.tsx` içinde:
```tsx
      {/* iOS 26: role="search" sekmesi bardan ayrik, sagda yuvarlak durur. */}
      <NativeTabs.Trigger name="search" role="search" contentStyle={content}>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" selectedColor={selectedIcon} />
        <NativeTabs.Trigger.Label selectedStyle={selectedLabel}>{t("Arama")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
```
şununla değiştir:
```tsx
      {/* iOS 26: role="search" ayrik yuvarlak butonu verir. Rol korunur, icerik AI:
          oneri akisi + arama. accessibilityLabel VoiceOver'in "Arama" okumasini ezer. */}
      <NativeTabs.Trigger name="ai" role="search" contentStyle={content} accessibilityLabel="Helm AI">
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" selectedColor={selectedIcon} />
        <NativeTabs.Trigger.Label selectedStyle={selectedLabel}>AI</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
```

- [ ] **Step 3: `ai/_layout.tsx`**

Tüm içeriği:
```tsx
import { Stack } from "expo-router";

import { useTheme } from "~/theme/use-theme";

/**
 * AI sekmesi (iOS 26 ayrik buton, role="search").
 *
 * NEDEN NATIVE BASLIK: arama cubugu native header'in parcasi (Stack.SearchBar);
 * rehber de arama rollu sekmeyi Stack icine sarmayi sart kosuyor.
 */
export default function AiLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerTintColor: theme.fg,
        headerLargeTitleStyle: { fontFamily: "Geist-600", color: theme.fg },
        headerTitleStyle: { fontFamily: "Geist-600", color: theme.fg },
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "AI" }} />
      <Stack.Screen name="[id]" options={{ title: "", headerLargeTitle: false }} />
    </Stack>
  );
}
```

- [ ] **Step 4: Eski rota referanslarını tara**

Run: `cd apps/mobile && grep -rn "(tabs)/search\|/search\"" app src | cat`
Expected: boş çıktı. Bulunursa `(tabs)/ai` yap.

- [ ] **Step 5: Commit** (typecheck Task 3 sonunda; `[id]` dosyası henüz yok, rota tipleri Metro ile yenilenir)

```bash
git add "apps/mobile/app/(cockpit)/(tabs)"
git commit -m "feat(mobile): WES-000 ayrik arama butonunu ai sekmesine cevir"
```

---

### Task 2: Arama index'ine öneri metni ve durum satırı mantığı

**Files:**
- Modify: `apps/mobile/src/lib/search-index.ts`
- Test: `apps/mobile/src/lib/__tests__/search-index.test.ts`
- Create: `apps/mobile/src/lib/insight-status.ts`
- Test: `apps/mobile/src/lib/__tests__/insight-status.test.ts`

**Interfaces:**
- Consumes: `Insight`, `InsightRun`, `insightText`, `isRunFresh` (`@helm/api`)
- Produces:
  - `SearchHitKind = "project" | "alert" | "account" | "insight"`
  - `buildSearchIndex(input: { properties; alerts; accounts; insights: readonly Insight[]; language: "tr" | "en" }): SearchEntry[]`
  - `insightStatusLine(input: { run: InsightRun | null; openCount: number; monthCost: number; now: Date; clock: (iso: string) => string }): { key: string; vars: Record<string, string | number>; tone: "normal" | "warn" }`

- [ ] **Step 1: Başarısız testleri yaz**

`apps/mobile/src/lib/__tests__/search-index.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import type { Insight } from "@helm/api";
import { buildSearchIndex, searchIndex } from "../search-index";

// Sentetik veri - gercek proje/oneri yok (repo public).
const insight: Insight = {
  id: "i1",
  project_id: null,
  tab: "revenue",
  kind: "risk",
  severity: "warn",
  text: { tr: { title: "Dolum oranı düştü", body: "Reklam dolumu" }, en: { title: "Fill rate dropped", body: "Ad fill" } },
  evidence: [],
  action: null,
  status: "new",
  snoozed_until: null,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("search-index insights", () => {
  it("oneri basligini secili dilde bulur", () => {
    const tr = buildSearchIndex({ properties: [], alerts: [], accounts: [], insights: [insight], language: "tr" });
    expect(searchIndex(tr, "dolum")[0]).toMatchObject({ kind: "insight", id: "i1", title: "Dolum oranı düştü" });
    const en = buildSearchIndex({ properties: [], alerts: [], accounts: [], insights: [insight], language: "en" });
    expect(searchIndex(en, "fill")[0]?.title).toBe("Fill rate dropped");
  });

  it("tr-TR katlama: buyuk İ ile arama eslesir", () => {
    const idx = buildSearchIndex({ properties: [], alerts: [], accounts: [], insights: [insight], language: "tr" });
    expect(searchIndex(idx, "ORANI")).toHaveLength(1);
  });
});
```

`apps/mobile/src/lib/__tests__/insight-status.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import type { InsightRun } from "@helm/api";
import { insightStatusLine } from "../insight-status";

const clock = () => "08:02";
const now = new Date("2026-03-02T09:00:00Z");
const run = (extra: Partial<InsightRun>): InsightRun => ({
  run_date: "2026-03-02", status: "ok", finished_at: "2026-03-02T05:02:00Z", insight_count: 3, cost_usd: 0.3, ...extra,
});

describe("insightStatusLine", () => {
  it("hic kosu yoksa ilk analiz mesaji", () => {
    expect(insightStatusLine({ run: null, openCount: 0, monthCost: 0, now, clock }).key).toBe("İlk analiz yarın 08:00'de.");
  });

  it("basarili kosu + acik oneri", () => {
    const line = insightStatusLine({ run: run({}), openCount: 4, monthCost: 3.2, now, clock });
    expect(line).toEqual({
      key: "Son analiz {time} · {n} öneri · bu ay ${cost} / $40",
      vars: { time: "08:02", n: 4, cost: "3.20" },
      tone: "normal",
    });
  });

  it("basarili kosu + acik oneri yok", () => {
    expect(insightStatusLine({ run: run({}), openCount: 0, monthCost: 1, now, clock }).key).toBe(
      "Bugün kayda değer bir sinyal yok · son analiz {time}",
    );
  });

  it("basarisiz ve butce doldu uyari tonunda", () => {
    expect(insightStatusLine({ run: run({ status: "failed" }), openCount: 0, monthCost: 1, now, clock }).tone).toBe("warn");
    const budget = insightStatusLine({ run: run({ status: "skipped_budget" }), openCount: 0, monthCost: 40, now, clock });
    expect(budget.key).toBe("Bu ayın $40 tavanı doldu; analiz ayın 1'inde devam eder.");
    expect(budget.tone).toBe("warn");
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `cd apps/mobile && bun test src/lib/__tests__/search-index.test.ts src/lib/__tests__/insight-status.test.ts`
Expected: FAIL (`insights` alanı yok / `../insight-status` modülü yok). `~/lib/labels` çözülemezse `search-index.ts` içindeki import'u `./labels` yap ve tekrar koş.

- [ ] **Step 3: `search-index.ts` değişiklikleri**

Import'lara ekle:
```ts
import { insightText, type Insight } from "@helm/api";
```
Tip:
```ts
export type SearchHitKind = "project" | "alert" | "account" | "insight";
```
`buildSearchIndex` imzası ve gövdesinin sonu:
```ts
export function buildSearchIndex(input: {
  properties: readonly Property[];
  alerts: readonly Alert[];
  accounts: readonly SocialAccount[];
  insights: readonly Insight[];
  language: "tr" | "en";
}): SearchEntry[] {
```
`accounts` döngüsünden sonra, `return entries;` önüne:
```ts
  for (const i of input.insights) {
    const text = insightText(i, input.language);
    entries.push(toEntry({ kind: "insight", id: i.id, title: text.title, sub: text.body }, [text.title, text.body]));
  }
```
Karmaşıklık yorumunu `O(p + a + s + i)` olarak güncelle.

- [ ] **Step 4: `insight-status.ts`**

```ts
import { isRunFresh, type InsightRun } from "@helm/api";

export type StatusLine = { key: string; vars: Record<string, string | number>; tone: "normal" | "warn" };

/**
 * AI sayfasi basligindaki tek satir. Metin ANAHTARI doner; ceviri ekranda (useT).
 * Saf: saat bicimlendirici disaridan gelir, test deterministik.
 */
export function insightStatusLine(input: {
  run: InsightRun | null;
  openCount: number;
  monthCost: number;
  now: Date;
  clock: (iso: string) => string;
}): StatusLine {
  const { run, openCount, monthCost, now, clock } = input;
  if (run == null) return { key: "İlk analiz yarın 08:00'de.", vars: {}, tone: "normal" };
  if (run.status === "skipped_budget") {
    return { key: "Bu ayın $40 tavanı doldu; analiz ayın 1'inde devam eder.", vars: {}, tone: "warn" };
  }
  if (run.status === "failed") return { key: "Bugünkü analiz başarısız", vars: {}, tone: "warn" };
  if (run.status === "running" || run.finished_at == null) {
    return { key: "Analiz sürüyor", vars: {}, tone: "normal" };
  }
  const time = clock(run.finished_at);
  const tone = isRunFresh(run, now) ? "normal" : "warn";
  if (openCount === 0) return { key: "Bugün kayda değer bir sinyal yok · son analiz {time}", vars: { time }, tone };
  return {
    key: "Son analiz {time} · {n} öneri · bu ay ${cost} / $40",
    vars: { time, n: openCount, cost: monthCost.toFixed(2) },
    tone,
  };
}
```

- [ ] **Step 5: Testler geçsin**

Run: `cd apps/mobile && bun test`
Expected: PASS (mevcut testler dahil)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/search-index.ts apps/mobile/src/lib/insight-status.ts apps/mobile/src/lib/__tests__/search-index.test.ts apps/mobile/src/lib/__tests__/insight-status.test.ts
git commit -m "feat(mobile): WES-000 aramaya oneri metnini ve ai durum satiri mantigini ekle"
```

---

### Task 3: AI akış ekranı ve detay

**Files:**
- Modify (yeniden yaz): `apps/mobile/app/(cockpit)/(tabs)/ai/index.tsx`
- Create: `apps/mobile/app/(cockpit)/(tabs)/ai/[id].tsx`
- Modify: `apps/mobile/src/lib/i18n.ts`

**Interfaces:**
- Consumes: `useInsightFeed`, `useInsight`, `useLatestInsightRun`, `useInsightMonthCost`, `useSetInsightStatus` (Faz 2); `InsightCard`, `ROUTE_HREF` (Faz 2); `insightStatusLine` (Task 2); `buildSearchIndex`, `searchIndex` (Task 2); `NativeSegmented<T extends string>({ value, options, onChange, height? })` (`~/components/liquid`); `formatClock(iso)` (`~/lib/format`); `Empty({ label })` (`~/components/bento`)
- Produces: rota `/(cockpit)/(tabs)/ai` (opsiyonel param `tab`), `/(cockpit)/(tabs)/ai/[id]`

- [ ] **Step 1: Tasarım skill'lerini yükle**

`Skill` ile `impeccable`, `emil-design-eng`, `design-taste-frontend`. Çelişkide `apps/mobile/design.md` kazanır.

- [ ] **Step 2: i18n çakışma kontrolü ve anahtarlar**

Run:
```bash
cd apps/mobile && for k in "Tümü" "Kapananlar ({n})" "Açık öneriler" "İlk analiz yarın 08:00'de." "Bu ayın \$40 tavanı doldu; analiz ayın 1'inde devam eder." "Bugünkü analiz başarısız" "Analiz sürüyor" "Bugün kayda değer bir sinyal yok · son analiz {time}" "Son analiz {time} · {n} öneri · bu ay \${cost} / \$40" "{n} gündür açık" "ÖNERİ" "Öneri bulunamadı"; do printf '%s=%s\n' "$k" "$(grep -cF "  \"$k\":" src/lib/i18n.ts)"; done
```
Expected: hepsi `0` (Faz 2'de eklenenler hariç). Dolu olan varsa metni değiştir.

`// Oneri kartlari` bloğunun altına:
```ts
  // AI sayfasi
  "Tümü": "All",
  "Kapananlar ({n})": "Closed ({n})",
  "Açık öneriler": "Open insights",
  "İlk analiz yarın 08:00'de.": "The first analysis runs tomorrow at 08:00.",
  "Bu ayın $40 tavanı doldu; analiz ayın 1'inde devam eder.": "This month's $40 cap is reached; analysis resumes on the 1st.",
  "Bugünkü analiz başarısız": "Today's analysis failed",
  "Analiz sürüyor": "Analysis running",
  "Bugün kayda değer bir sinyal yok · son analiz {time}": "No notable signals today · last analysis {time}",
  "Son analiz {time} · {n} öneri · bu ay ${cost} / $40": "Last analysis {time} · {n} insights · ${cost} / $40 this month",
  "{n} gündür açık": "Open for {n} days",
  "ÖNERİ": "INSIGHT",
  "Öneri bulunamadı": "Insight not found",
```

- [ ] **Step 3: `ai/index.tsx`**

Tüm içeriği:
```tsx
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { press, space, withAlpha } from "@helm/design";
import type { InsightTab } from "@helm/api";

import { BentoTile, Empty } from "~/components/bento";
import { InsightCard, ROUTE_HREF } from "~/components/insights";
import { NativeSegmented } from "~/components/liquid";
import { useAlerts } from "~/hooks/use-alerts";
import {
  useInsightFeed,
  useInsightMonthCost,
  useLatestInsightRun,
  useSetInsightStatus,
} from "~/hooks/use-insights";
import { useProperties } from "~/hooks/use-properties";
import { useSocialAccounts } from "~/hooks/use-social";
import { formatClock } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { insightStatusLine } from "~/lib/insight-status";
import { preferences, usePreferences } from "~/lib/preferences";
import { buildSearchIndex, searchIndex, type SearchHit } from "~/lib/search-index";
import { useTheme } from "~/theme/use-theme";

// Segment etiketi ceviri ANAHTARI; secim index ile (social/index.tsx ile ayni gerekce).
const FILTERS: ReadonlyArray<{ key: string; tab: InsightTab | "all" }> = [
  { key: "Tümü", tab: "all" },
  { key: "Özet", tab: "overview" },
  { key: "Gelir", tab: "revenue" },
  { key: "Kullanıcı", tab: "users" },
  { key: "Sosyal", tab: "social" },
];

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  project: "PROJE",
  alert: "UYARI",
  account: "HESAP",
  insight: "ÖNERİ",
};

const SNOOZE_DAYS = 3;

export default function AiScreen() {
  const t = useT();
  const router = useRouter();
  const { theme } = useTheme();
  const { language } = usePreferences();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial = Math.max(0, FILTERS.findIndex((f) => f.tab === params.tab));
  const [filter, setFilter] = useState(initial);
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");

  const active = FILTERS[filter] ?? FILTERS[0]!;
  const feed = useInsightFeed(active.tab, archived);
  const closed = useInsightFeed(active.tab, true);
  const openAll = useInsightFeed("all", false);
  const run = useLatestInsightRun();
  const cost = useInsightMonthCost();
  const setStatus = useSetInsightStatus();
  const properties = useProperties();
  const alerts = useAlerts();
  const accounts = useSocialAccounts();

  const names = useMemo(() => new Map((properties.data ?? []).map((p) => [p.id, p.name])), [properties.data]);
  // Arama index'i veri degisince bir kez; sorgu her tusta yalniz filtrelenir.
  const index = useMemo(
    () =>
      buildSearchIndex({
        properties: properties.data ?? [],
        alerts: alerts.data ?? [],
        accounts: accounts.data ?? [],
        insights: openAll.data ?? [],
        language,
      }),
    [properties.data, alerts.data, accounts.data, openAll.data, language],
  );
  const hits = useMemo(() => searchIndex(index, query), [index, query]);

  const status = insightStatusLine({
    run: run.data ?? null,
    openCount: openAll.data?.length ?? 0,
    monthCost: cost.data ?? 0,
    now: new Date(),
    clock: formatClock,
  });

  const openHit = (hit: SearchHit) => {
    haptic.tap();
    if (hit.kind === "insight") return router.push(`/(cockpit)/(tabs)/ai/${hit.id}`);
    if (hit.kind === "project") {
      preferences.setSelectedProperty(hit.id);
      return router.navigate("/(cockpit)/(tabs)/overview");
    }
    router.navigate(hit.kind === "alert" ? "/(cockpit)/(tabs)/overview" : "/(cockpit)/(tabs)/social");
  };

  const change = (id: string, next: "dismissed" | "snoozed") => {
    haptic.tap();
    const snoozeUntil = next === "snoozed" ? new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString() : undefined;
    setStatus.mutate({ id, status: next, ...(snoozeUntil ? { snoozeUntil } : {}) });
  };

  const labels = FILTERS.map((f) => t(f.key));
  const items = feed.data ?? [];

  return (
    <>
      <Stack.SearchBar
        placement="automatic"
        placeholder={t("Proje, uyarı veya hesap ara")}
        autoCapitalize="none"
        onChangeText={(e) => setQuery(e.nativeEvent.text)}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: space.screenX, paddingBottom: 120, gap: space.tileGap }}
      >
        {query.trim().length > 0 ? (
          hits.length === 0 ? (
            <Empty label={t("Sonuç yok")} />
          ) : (
            <BentoTile>
              {hits.map((hit, i) => (
                <Pressable key={`${hit.kind}-${hit.id}`} onPress={() => openHit(hit)} accessibilityRole="button">
                  {({ pressed }) => (
                    <View
                      style={{
                        paddingVertical: space.tilePadSm,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: withAlpha(theme.fg3, 0.2),
                        opacity: pressed ? press.opacity : 1,
                      }}
                    >
                      <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">{t(KIND_LABEL[hit.kind])}</Text>
                      <Text className="mt-xs font-semibold text-body text-fg" numberOfLines={1}>{hit.title}</Text>
                      <Text className="text-meta text-fg3" numberOfLines={1}>{hit.sub}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </BentoTile>
          )
        ) : (
          <>
            <Text
              className="font-mono-medium text-meta"
              style={{ color: status.tone === "warn" ? theme.warn : theme.fg2 }}
            >
              {t(status.key, status.vars)}
            </Text>

            <NativeSegmented
              value={labels[filter] ?? labels[0] ?? ""}
              options={labels}
              onChange={(label) => {
                const next = labels.indexOf(label);
                if (next < 0 || next === filter) return;
                haptic.selection();
                setFilter(next);
              }}
            />

            {items.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                variant="full"
                projectName={insight.project_id != null ? (names.get(insight.project_id) ?? null) : null}
                onOpen={() => router.push(`/(cockpit)/(tabs)/ai/${insight.id}`)}
                onAction={archived ? null : (route) => router.navigate(ROUTE_HREF[route])}
                onSnooze={() => change(insight.id, "snoozed")}
                onDismiss={() => change(insight.id, "dismissed")}
                error={setStatus.isError && setStatus.variables?.id === insight.id ? t("Öneri güncellenemedi") : null}
              />
            ))}

            <Pressable onPress={() => setArchived((a) => !a)} accessibilityRole="button" hitSlop={8}>
              <Text className="font-mono-medium text-eyebrow tracking-wide text-fg2">
                {archived ? t("Açık öneriler") : t("Kapananlar ({n})", { n: closed.data?.length ?? 0 })} ›
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </>
  );
}
```

Not: arşiv görünümünde "Sonra"/"Geç" RPC tarafında zaten kapanmış kayda etki etmez; kart yine de çizer. İstenmiyorsa arşivde `InsightCard`'a no-op geçmek yerine Faz 3 sonrası ayrı bir `readOnly` prop'u eklenir (bu planda eklenmez, YAGNI).

- [ ] **Step 4: `ai/[id].tsx`**

```tsx
import { useEffect } from "react";
import { ScrollView, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { space } from "@helm/design";

import { Empty } from "~/components/bento";
import { InsightCard, ROUTE_HREF } from "~/components/insights";
import { useInsight, useSetInsightStatus } from "~/hooks/use-insights";
import { useProperties } from "~/hooks/use-properties";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";

const SNOOZE_DAYS = 3;

export default function InsightDetail() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insight = useInsight(id);
  const properties = useProperties();
  const setStatus = useSetInsightStatus();

  const item = insight.data ?? null;

  // Detay acildi = goruldu. Yalniz 'new' ise; RPC zaten baska gecisi reddeder.
  useEffect(() => {
    if (item?.status === "new") setStatus.mutate({ id: item.id, status: "seen" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.status]);

  if (insight.isLoading) return null;
  if (item == null) return <Empty label={t("Öneri bulunamadı")} />;

  const days = Math.max(0, Math.floor((Date.now() - Date.parse(item.created_at)) / 86_400_000));
  const projectName = item.project_id != null
    ? ((properties.data ?? []).find((p) => p.id === item.project_id)?.name ?? null)
    : null;

  const close = (next: "dismissed" | "snoozed") => {
    haptic.tap();
    const snoozeUntil = next === "snoozed" ? new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString() : undefined;
    setStatus.mutate({ id: item.id, status: next, ...(snoozeUntil ? { snoozeUntil } : {}) });
    router.back();
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: space.screenX, paddingBottom: 120, gap: space.tileGap }}
    >
      <Text className="font-mono-medium text-meta text-fg3">{t("{n} gündür açık", { n: days })}</Text>
      <InsightCard
        insight={item}
        variant="full"
        projectName={projectName}
        onAction={(route) => router.navigate(ROUTE_HREF[route])}
        onSnooze={() => close("snoozed")}
        onDismiss={() => close("dismissed")}
        error={setStatus.isError ? t("Öneri güncellenemedi") : null}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 5: Typecheck (Metro rota tiplerini yeniledikten sonra)**

`mobile-metro`'yu launch.json ile başlat, bir bundle isteği at:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&minify=false"
```
Expected: `200`. Sonra:
```bash
cd apps/mobile && grep -c "(tabs)/ai" .expo/types/router.d.ts && bun run typecheck
```
Expected: sayı > 0, typecheck çıkış kodu 0. `Stack.SearchBar` `onChangeText` tipi farklıysa mevcut (Faz öncesi) `search/index.tsx`'teki `e.nativeEvent.text` kullanımı referanstır.

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(cockpit)/(tabs)/ai" apps/mobile/src/lib/i18n.ts
git commit -m "feat(mobile): WES-000 ai sayfasina oneri akisi, arsiv, arama ve detay ekrani ekle"
```

---

### Task 4: Sekme kartlarını AI sayfasına bağla, dokümanlar, simülatör

**Files:**
- Modify: `apps/mobile/src/components/insights/insight-slot.tsx`
- Modify: `apps/mobile/design.md`
- Modify: `apps/mobile/CLAUDE.md`

**Interfaces:**
- Consumes: `InsightCard` `onOpen`/`moreCount`/`onMore` (Faz 2), rotalar (Task 3)

- [ ] **Step 1: Slot'a dokunma ve "+N"**

`insight-slot.tsx` içindeki `<InsightCard` prop listesine, `error=` satırının üstüne:
```tsx
          onOpen={() => router.push(`/(cockpit)/(tabs)/ai/${top.id}`)}
          moreCount={(insights.data?.length ?? 1) - 1}
          onMore={() => router.navigate({ pathname: "/(cockpit)/(tabs)/ai", params: { tab } })}
```

- [ ] **Step 2: Dokümanlar**

`apps/mobile/design.md` §9 ilk satırında `+ ayrık **Search** (\`role="search"\`)` → `+ ayrık **AI** (\`role="search"\`, ikon \`sparkles\`: öneri akışı + arama)`.

`apps/mobile/CLAUDE.md` §5 "Tab bar" satırında `+ ayrık Ara (\`role="search"\`)` → `+ ayrık AI (\`role="search"\`)`.

Run: `grep -n "ayrık Ara\|ayrık \*\*Search" apps/mobile/design.md apps/mobile/CLAUDE.md`
Expected: boş

- [ ] **Step 3: Typecheck + testler**

Run: `cd /Users/canakyuz/Developer/wesan/platform/helm && bun run typecheck && (cd apps/mobile && bun test)`
Expected: çıkış kodu 0

- [ ] **Step 4: Simülatör doğrulaması**

Uygulamayı yeniden aç:
```bash
xcrun simctl terminate booted com.canakyuz.helmmobile; xcrun simctl openurl booted "com.canakyuz.helmmobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```
Kontrol ve her biri için ekran görüntüsü (`xcrun simctl io booted screenshot <scratchpad>/ai-N.png`):
1. Tab bar: 4 sekme + sağda `sparkles` ayrık buton; "More" menüsü yok.
2. AI sayfası: büyük "AI" başlığı, durum satırı (koşu yoksa "İlk analiz yarın 08:00'de."), segment, kartlar ya da boş.
3. Segment "Gelir": yalnız revenue önerileri; geçişte animasyon yok.
4. Aramaya "fill" (EN) / "dolum" (TR) yaz: öneri sonucu "ÖNERİ" etiketiyle; dokununca detay.
5. Detay: "N gündür açık", tam kanıt; geri → akış; kart `seen` (tekrar açınca istek hatası yok, Metro logu temiz).
6. Özet kartına dokun → detay; "+N öneri daha" → AI sayfası "Özet" segmentinde.
7. VoiceOver etiketi: Accessibility Inspector ile ayrık butonun okunan adını not et ("Helm AI" ve varsa ek "arama" niteliği) ve raporda belirt.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/insights/insight-slot.tsx apps/mobile/design.md apps/mobile/CLAUDE.md
git commit -m "feat(mobile): WES-000 sekme kartlarini ai sayfasina bagla ve dokumanlari guncelle"
```

---

## Self-Review (yazar)

- Spec §5 tab butonu (rol korunur, `sparkles`, "AI", `accessibilityLabel`) → Task 1.
- Başlık satırı (saat · sayı · maliyet/$40, failed/skipped_budget uyarı) → Task 2 `insightStatusLine` + Task 3.
- Segment filtresi, tam kart akışı, "Kapananlar (N)" arşiv → Task 3.
- Arama korunur + öneri metni → Task 2 + Task 3.
- Detay `/ai/[id]`, "N gündür açık", `seen` → Task 3.
- Aksiyonlar yalnız gezinme, onay kartı yok → Task 3 (`ROUTE_HREF`).
- Boş durumlar spec metinleriyle → Task 2 testleri + Task 3.
- Faz 2 karta dokunma ve "+N" → Task 4.
- Aşama 2 öğeleri yok (Global Constraints).
