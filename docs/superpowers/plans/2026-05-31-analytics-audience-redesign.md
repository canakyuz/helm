# Analytics Audience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn Analytics into an audience-focused screen - DAU hero + native DAU/WAU/MAU segment, a live Apple Map of users by country, then funnel/acquisition/retention/reviews/OS - with Reviews extracted to a shared component used by both Analytics and Health.

**Architecture:** Three new shared units (`country-geo.ts` static table, `<AudienceMap>` wrapping `expo-maps` AppleMaps.View, `<ReviewsSection>` extracted verbatim from Health). Analytics composes them in the agreed B layout; Health swaps its inline reviews block for `<ReviewsSection>`. expo-maps is installed + native-rebuilt (verified, 0 errors).

**Tech Stack:** Expo SDK 56, expo-maps (AppleMaps), @expo/ui (NativeSegmented), TanStack Query hooks (useGeoBreakdown/useReviews/useReviewReply etc), TypeScript strict.

> **Testing (project rule):** No test-first/unit obsession; native map + presentational RN aren't unit-tested. Each task gate = `bun run typecheck` clean + simulator visual check (`curl -s localhost:8081/reload` then `xcrun simctl io booted screenshot`) + single-line conventional commit.

---

## File Structure
```
src/lib/country-geo.ts                     CREATE - ISO-2 → {lat,lng,name} static table + lookup
src/components/liquid/audience-map.tsx     CREATE - <AudienceMap rows={GeoRow[]}> Apple Map + country markers
src/components/liquid/reviews-section.tsx  CREATE - <ReviewsSection/> (rating + histogram + ReviewRows + reply), self-contained
src/components/liquid/index.ts             MODIFY - export AudienceMap, ReviewsSection
app/(cockpit)/health.tsx                   MODIFY - replace inline reviews with <ReviewsSection/>
app/(cockpit)/analytics.tsx                MODIFY - native DAU/WAU/MAU segment; add Where(map) + Reviews sections; reorder
```

---

### Task 1: Country geo table

**Files:**
- Create: `src/lib/country-geo.ts`

- [ ] **Step 1: Create the static table + lookup**

```typescript
// ISO 3166-1 alpha-2 → approximate country centroid + display name.
// Subset of common countries; unknown codes return null (caller skips the marker).

export type CountryGeo = { lat: number; lng: number; name: string };

const TABLE: Record<string, CountryGeo> = {
  US: { lat: 39.8, lng: -98.6, name: "United States" },
  TR: { lat: 39.0, lng: 35.2, name: "Türkiye" },
  DE: { lat: 51.2, lng: 10.4, name: "Germany" },
  GB: { lat: 54.0, lng: -2.0, name: "United Kingdom" },
  FR: { lat: 46.6, lng: 2.2, name: "France" },
  BR: { lat: -14.2, lng: -51.9, name: "Brazil" },
  JP: { lat: 36.2, lng: 138.3, name: "Japan" },
  IN: { lat: 22.6, lng: 79.0, name: "India" },
  CA: { lat: 56.1, lng: -106.3, name: "Canada" },
  AU: { lat: -25.3, lng: 133.8, name: "Australia" },
  NL: { lat: 52.1, lng: 5.3, name: "Netherlands" },
  ES: { lat: 40.2, lng: -3.7, name: "Spain" },
  IT: { lat: 41.9, lng: 12.6, name: "Italy" },
  RU: { lat: 61.5, lng: 105.3, name: "Russia" },
  MX: { lat: 23.6, lng: -102.5, name: "Mexico" },
  ID: { lat: -0.8, lng: 113.9, name: "Indonesia" },
  KR: { lat: 35.9, lng: 127.8, name: "South Korea" },
  SA: { lat: 23.9, lng: 45.1, name: "Saudi Arabia" },
  AE: { lat: 23.4, lng: 53.8, name: "UAE" },
  PL: { lat: 51.9, lng: 19.1, name: "Poland" },
  SE: { lat: 60.1, lng: 18.6, name: "Sweden" },
  AR: { lat: -38.4, lng: -63.6, name: "Argentina" },
  EG: { lat: 26.8, lng: 30.8, name: "Egypt" },
  ZA: { lat: -30.6, lng: 22.9, name: "South Africa" },
  NG: { lat: 9.1, lng: 8.7, name: "Nigeria" },
};

export function countryGeo(code: string): CountryGeo | null {
  return TABLE[code?.toUpperCase()?.trim()] ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/country-geo.ts
git commit -m "feat(mobile-analytics): WES-000 add country geo centroid table for map markers"
```

---

### Task 2: AudienceMap component

**Files:**
- Create: `src/components/liquid/audience-map.tsx`

> Wraps `expo-maps` AppleMaps.View. Uses the real `GeoRow[]` (country, country_name, users) the
> Analytics geo hook already returns. Markers from `countryGeo` lookup; unknown codes skipped.
> iOS<18 has no marker tap - fine, the screen also lists countries below.

- [ ] **Step 1: Create `audience-map.tsx`**

```typescript
import { useMemo } from "react";
import { View } from "react-native";
import { AppleMaps } from "expo-maps";

import { countryGeo } from "~/lib/country-geo";
import { colors, glass } from "~/theme/tokens";
import { formatInteger } from "~/lib/format";

export type AudienceMapRow = { country: string; country_name: string | null; users: number };

export function AudienceMap({ rows, height = 200 }: { rows: AudienceMapRow[]; height?: number }) {
  const markers = useMemo(() => {
    return rows
      .map((r) => {
        const geo = countryGeo(r.country);
        if (!geo) return null;
        return {
          id: r.country,
          coordinates: { latitude: geo.lat, longitude: geo.lng },
          title: `${r.country_name ?? geo.name} · ${formatInteger(r.users)}`,
          tintColor: colors.accent,
          monogram: r.country.toUpperCase().slice(0, 2),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [rows]);

  return (
    <View
      style={{
        height,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: glass.radiusSm,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <AppleMaps.View
        style={{ flex: 1 }}
        colorScheme="DARK"
        cameraPosition={{ coordinates: { latitude: 20, longitude: 0 }, zoom: 0.7 }}
        markers={markers}
        properties={{ isMyLocationEnabled: false, isTrafficEnabled: false }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors. If `colorScheme="DARK"` string is rejected, use `AppleMaps.MapColorScheme.DARK`. If `properties` keys mismatch, drop the `properties` prop (optional).

- [ ] **Step 3: Commit**

```bash
git add src/components/liquid/audience-map.tsx
git commit -m "feat(mobile-analytics): WES-000 add AudienceMap (expo-maps Apple Maps + country markers)"
```

---

### Task 3: Extract ReviewsSection (shared)

**Files:**
- Create: `src/components/liquid/reviews-section.tsx`

> Moves Health's inline reviews verbatim into a self-contained component (own hooks).
> Behavior unchanged: rating + histogram header, expandable rows, reply via useReviewReply.

- [ ] **Step 1: Create `reviews-section.tsx`**

```typescript
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useReviews } from "~/hooks/use-reviews";
import { useReviewReply } from "~/hooks/use-review-reply";
import { formatInteger, formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { colors, type } from "~/theme/tokens";
import { CardSection, Row, HBar, Stars, ActionBtn, EmptyHint } from "~/components/liquid";

const MONO_500 = "GeistMono-500";
const MONO_600 = "GeistMono-600";

type ReviewItem = {
  id: number;
  rating: number | null;
  body: string | null;
  source: "appstore" | "playstore";
  review_date: string | null;
  developer_response: string | null;
};

function ReviewRows({ items, reply }: { items: ReviewItem[]; reply: ReturnType<typeof useReviewReply> }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [replied, setReplied] = useState<Record<number, boolean>>({});
  if (items.length === 0) return <EmptyHint>NO REVIEWS YET</EmptyHint>;
  return (
    <View>
      {items.map((r, i) => {
        const open = openId === r.id;
        const hasReply = replied[r.id] || !!r.developer_response;
        return (
          <Row
            key={r.id}
            open={open}
            onToggle={() => setOpenId(open ? null : r.id)}
            isLast={i === items.length - 1}
            header={
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Stars n={r.rating ?? 0} size={10} />
                  <Text style={{ flex: 1, fontFamily: MONO_500, fontSize: 9, color: colors.fgMuted, letterSpacing: 0.4 }}>
                    {r.source.toUpperCase()}
                  </Text>
                  {hasReply ? (
                    <Text style={{ fontFamily: MONO_500, fontSize: 8, color: colors.green, letterSpacing: 0.6 }}>✓ REPLIED</Text>
                  ) : null}
                  <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.fgSubtle }}>
                    {r.review_date ? formatRelativeTime(r.review_date) : ""}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Geist-400", fontSize: type.bodySm, color: colors.fgSecondary }} numberOfLines={1}>
                  {r.body ?? "-"}
                </Text>
              </View>
            }
            detail={
              <>
                <Text style={{ fontFamily: "Geist-400", fontSize: type.body, color: colors.fgSecondary, lineHeight: 18 }}>
                  {r.body ?? "-"}
                </Text>
                {hasReply ? (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: `${colors.green}14`,
                      borderWidth: 1,
                      borderColor: `${colors.green}3D`,
                    }}
                  >
                    <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.green, letterSpacing: 0.6 }}>YOUR REPLY</Text>
                    <Text style={{ fontFamily: "Geist-400", fontSize: type.bodySm, color: colors.fgSecondary, marginTop: 4 }}>
                      {r.developer_response ?? draft[r.id] ?? "Thanks for the feedback - we're on it!"}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      value={draft[r.id] ?? ""}
                      onChangeText={(t) => setDraft((d) => ({ ...d, [r.id]: t }))}
                      placeholder="Write a reply…"
                      placeholderTextColor={colors.fgSubtle}
                      multiline
                      style={{
                        minHeight: 56,
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 12,
                        color: colors.fgPrimary,
                        fontFamily: "Geist-400",
                        fontSize: type.body,
                        textAlignVertical: "top",
                      }}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <ActionBtn
                        label="SEND REPLY"
                        tone="accent"
                        onPress={() => {
                          const body = draft[r.id];
                          if (!body || !body.trim()) return;
                          haptic.tap();
                          reply.mutate(
                            { review_id: r.id, body },
                            { onSuccess: () => setReplied((s) => ({ ...s, [r.id]: true })) },
                          );
                        }}
                      />
                    </View>
                  </>
                )}
              </>
            }
          />
        );
      })}
    </View>
  );
}

export function ReviewsSection({ index = "05" }: { index?: string }) {
  const reviewsQuery = useReviews();
  const reply = useReviewReply();
  const reviews = (reviewsQuery.data?.reviews ?? []).slice(0, 6) as ReviewItem[];
  const ratingAvg = reviewsQuery.data?.average ?? 0;
  const ratingTotal = reviewsQuery.data?.total ?? 0;
  const distribution = reviewsQuery.data?.distribution;
  const histMax = distribution
    ? Math.max(distribution[1], distribution[2], distribution[3], distribution[4], distribution[5], 1)
    : 1;

  return (
    <CardSection index={index} title="Reviews & ratings" action="App Store">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: MONO_600, fontSize: type.stat, lineHeight: 24, color: colors.fgPrimary, letterSpacing: -0.5 }}>
            {ratingAvg.toFixed(1)}
          </Text>
          <Stars n={Math.round(ratingAvg)} size={11} />
          <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgSubtle, letterSpacing: 0.6, marginTop: 4 }}>
            {formatInteger(ratingTotal)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {[5, 4, 3, 2, 1].map((s) => {
            const n = distribution ? distribution[s as 1 | 2 | 3 | 4 | 5] : 0;
            return (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgSubtle, width: 8 }}>{s}</Text>
                <View style={{ flex: 1 }}>
                  <HBar pct={(n / histMax) * 100} color={colors.accentWarn} height={4} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <ReviewRows items={reviews} reply={reply} />
    </CardSection>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/liquid/reviews-section.tsx
git commit -m "feat(mobile): WES-000 extract shared ReviewsSection from Health"
```

---

### Task 4: Export from barrel

**Files:**
- Modify: `src/components/liquid/index.ts`

- [ ] **Step 1: Add exports**

Append to `src/components/liquid/index.ts`:
```typescript
export { AudienceMap } from "./audience-map";
export type { AudienceMapRow } from "./audience-map";
export { ReviewsSection } from "./reviews-section";
```

- [ ] **Step 2: Typecheck + Commit**

Run: `bun run typecheck` → 0 errors.
```bash
git add src/components/liquid/index.ts
git commit -m "feat(mobile): WES-000 export AudienceMap + ReviewsSection from liquid barrel"
```

---

### Task 5: Health uses shared ReviewsSection

**Files:**
- Modify: `app/(cockpit)/health.tsx`

> Replace the inline reviews block (CardSection "05 Reviews & ratings" at ~514-541) and the local
> `ReviewRows`/`ReviewItem` (~250-360) with the shared `<ReviewsSection />`. Keep everything else.

- [ ] **Step 1: Replace the inline Reviews CardSection**

In `app/(cockpit)/health.tsx`, replace the whole block from `<FullDivider />` + `<CardSection index="05" title="Reviews & ratings" ...>` … `</CardSection>` (the reviews card, lines ~514-541) with:
```tsx
            <FullDivider />
            <ReviewsSection index="05" />
```

- [ ] **Step 2: Delete now-dead local code**

Delete the local `type ReviewItem` and `function ReviewRows` (the ~250-360 block). Then remove now-unused imports/vars in health.tsx: `useReviews`, `useReviewReply`, `TextInput` (if unused elsewhere), and the `reviewsQuery`/`reply`/`reviews`/`ratingAvg`/`ratingTotal`/`distribution`/`histMax` locals in the `Health` component body. Add the import: `import { ReviewsSection } from "~/components/liquid";` (or add to the existing liquid import block).

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors. Fix any "declared but never read" by removing the dead local/import the error names.

- [ ] **Step 4: Visual check**

`curl -s localhost:8081/reload`; on Health tab, scroll to Reviews - identical look + reply flow still works.

- [ ] **Step 5: Commit**

```bash
git add "app/(cockpit)/health.tsx"
git commit -m "refactor(mobile-health): WES-000 use shared ReviewsSection (behavior unchanged)"
```

---

### Task 6: Analytics - native segment + map + reviews + reorder

**Files:**
- Modify: `app/(cockpit)/analytics.tsx`

> B layout. Hero DAU/WAU/MAU `<Seg>` → `<NativeSegmented>`. Add a "Where" section showing
> `<AudienceMap>` above the existing countries list (CountriesSection already fetches `useGeoBreakdown`).
> Add `<ReviewsSection>`. Reorder: Where → Funnel → Acquisition → Retention → Reviews → OS.

- [ ] **Step 1: Imports**

Add to the liquid import block in `analytics.tsx`: `NativeSegmented, AudienceMap, ReviewsSection`. Keep `Seg` only if still used elsewhere (it isn't after step 2 - remove it then).

- [ ] **Step 2: Hero segment → native**

Replace the hero `right={ <Seg<Metric> ... /> }` with:
```tsx
            right={
              <View style={{ width: 150 }}>
                <NativeSegmented<Metric>
                  value={metric}
                  options={["DAU", "WAU", "MAU"]}
                  onChange={(v) => {
                    haptic.tap();
                    setMetric(v);
                  }}
                />
              </View>
            }
```

- [ ] **Step 3: Add a Where (map) section component**

Add this section component near the others (it reuses the geo hook; the existing `CountriesSection` already renders the list, so Where = map only, placed right before it). Add near top-level of file:
```tsx
function WhereSection({ projectId }: { projectId?: string | undefined }) {
  const q = useGeoBreakdown(projectId);
  const rows = q.data?.rows ?? [];
  return (
    <CardSection index="01" title="Where" pt={14} {...(rows.length ? { count: rows.length } : {})}>
      {!projectId ? (
        <EmptyHint>SELECT A PROJECT</EmptyHint>
      ) : q.isLoading ? (
        <EmptyHint>LOADING…</EmptyHint>
      ) : rows.length === 0 ? (
        <EmptyHint>NO GEO DATA</EmptyHint>
      ) : (
        <AudienceMap rows={rows} />
      )}
    </CardSection>
  );
}
```
`useGeoBreakdown` is already imported in analytics.tsx (used by CountriesSection). `AudienceMap`/`EmptyHint`/`CardSection` from `~/components/liquid`.

- [ ] **Step 4: Reorder the sections block + renumber indices**

Replace the `<LiquidGlass padding={0}>` children with this order (renumber the `index=` props on each existing CardSection accordingly - Where=01, Funnel=02, Acquisition=03, Retention=04, Reviews=05, OS=06):
```tsx
          <LiquidGlass padding={0}>
            <WhereSection projectId={projectId} />
            <FullDivider />
            <CountriesSection projectId={projectId} />
            <FullDivider />
            <FunnelSection projectId={projectId} />
            <FullDivider />
            <AcquisitionSection projectId={projectId} />
            <FullDivider />
            <RetentionSection projectId={projectId} />
            <FullDivider />
            <ReviewsSection index="05" />
            <FullDivider />
            <OsSection projectId={projectId} />
          </LiquidGlass>
```
Then update each section's internal `index="…"` string to match its new position: CountriesSection title stays "Top countries" but its `CardSection index` → "01b" is wrong - instead keep Where as the only "01", and set: CountriesSection index "01" is replaced - give CountriesSection NO index change is fine since Where owns 01; BUT to avoid two "01"s, set CountriesSection's CardSection index to "" (drop number, it's the list under the map) OR renumber. SIMPLEST: WhereSection index "01"; CountriesSection drop its index prop (omit `index`); Funnel "02"; Acquisition "03"; Retention "04"; ReviewsSection index "05"; OsSection "06". Edit each existing CardSection's `index=` accordingly.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors. Remove `Seg` import if now unused; remove `Bars`-unrelated leftovers only if flagged.

- [ ] **Step 6: Visual check**

`curl -s localhost:8081/reload`; Analytics tab: DAU/WAU/MAU is native segmented; "Where" shows a dark Apple map with country markers; reviews appear; order is Where→countries→funnel→acquisition→retention→reviews→OS. Screenshot to confirm map renders.

- [ ] **Step 7: Commit**

```bash
git add "app/(cockpit)/analytics.tsx"
git commit -m "feat(mobile-analytics): WES-000 audience layout - native segment, Apple map Where section, shared Reviews, reorder"
```

---

## Self-Review

**Spec coverage:** hero native segment (T6) ✓ · Apple map Where (T1,T2,T6) ✓ · Reviews shared + both screens (T3,T4,T5,T6) ✓ · reorder (T6) ✓ · country-geo (T1) ✓ · OS secondary last (T6) ✓.

**Placeholder scan:** Task 6 Step 4 contains prose reasoning about index numbering rather than one final code block - the implementer must apply the SIMPLEST rule stated (Where=01, CountriesSection omit index, Funnel=02, Acquisition=03, Retention=04, Reviews=05, OS=06). This is a guided edit, not a silent TODO. No other placeholders.

**Type consistency:** `AudienceMapRow` (country, country_name, users) matches `GeoRow` from use-analytics. `ReviewsSection({index})` signature consistent T3/T5/T6. `NativeSegmented<T>` matches existing usage in Overview/Revenue. `countryGeo` returns `CountryGeo|null`, consumer filters null.

**Known verification points (implementer must check, not guess):** expo-maps `colorScheme` string vs enum (T2 Step2 fallback); exact line ranges in health.tsx for deletion (T5 - search by content, not line number); whether `Seg` becomes unused in analytics (T6 Step5).
