# helm liquid glass - Foundation + Overview (Slice 1)

_Design spec · 2026-05-30 · WES-000_

## Context

Claude Design produced a handoff bundle (`helm liquid glass.html`) that redesigns
helm-mobile in an Apple iOS-26 "liquid glass" language. The prototype is HTML/CSS/JS
with mock data; this spec recreates its **visual output and interaction model** in the
real Expo/React Native app, wired to existing Supabase hooks where data exists.

The prototype expands the IA from the current 4 tabs + 9 "more" detail screens to
**5 tabs: Overview · Revenue · Analytics · Health · Settings**.

This spec covers **Slice 1 only**: the shared design-system foundation + the Overview
screen. The other 4 screens are scaffolded as placeholders so the app builds; they are
separate later slices.

### Decisions (locked with user)

1. **Data: hybrid.** Wire to real hooks where data exists (KPIs, alerts, reviews,
   Sentry, properties, app versions, users, system health). Mock-only prototype concepts
   (revenue mix, MRR movement, payouts, acquisition, retention/funnel, monthly goal,
   crash-free %) live in `src/lib/demo-data.ts`, every value visibly tagged `DEMO` so it
   is never mistaken for real data.
2. **Scope: foundation + Overview first**, then sign-off, then remaining screens.
3. **IA: replace and remove.** New 5-tab structure replaces home/growth/reviews/more.
   Old detail-screen data folds into new screens in later slices (errors+reviews+versions
   → Health; properties → Overview). In Slice 1, old route files are removed only once
   Overview + foundation exist and the 4 placeholder tabs render.
4. **Tab bar: keep `NativeTabs`** (native iOS bottom bar). Rename to the 5 new tabs with
   SF Symbol icons. No custom floating-pill bar (prototype's floating bar is dropped).
   The top header row (logo · property picker · bell) is rendered inside each screen.
5. **Glass: `GlassView` from `expo-glass-effect`** (real iOS-26 Liquid Glass) as the
   primitive, behind `isLiquidGlassAvailable()`, with a `BlurView` fallback for older iOS.

### Non-goals (this slice)

- Revenue / Analytics / Health / Settings full builds (placeholders only).
- Accent-color customization - V1 stays fixed lime (`#D4FF4D`) per project rules.
- The prototype's dev "tweaks panel" - prototype-only, not shipping.
- Light mode - dark only, per project rules.

## Architecture

```
src/theme/tokens.ts        ← extend: 4-step fg, bgDeep, green/blue, glass recipe consts
src/components/liquid/      ← NEW design-system layer
  glass.tsx                 ← <LiquidGlass> (GlassView | BlurView fallback) + tone/glow/deco
  background.tsx            ← <LiquidBackground> (Skia blobs + grid + grain, Reanimated drift)
  hero.tsx                  ← <OpenHero>, <MiniStat>, <Sep>
  card-section.tsx          ← <CardSection>, <FullDivider>
  row.tsx                   ← <Row>, <KV>, <Chevron>
  primitives.tsx            ← <Delta>, <Eyebrow>, <Glyph>, <StatusDot>, <CornerTicks>,
                              <CountUp>, <Seg>, <ActionBtn>, <SearchInput>, <EmptyHint>
  charts.tsx                ← <AreaChart>, <Bars>, <Ring>, <HBar>, <StackBar>, <Spark> (Skia)
  header.tsx                ← <LiquidHeader> (logo+sync dot · property picker · bell+badge)
  index.ts                  ← barrel export
src/lib/demo-data.ts        ← NEW: tagged demo values for mock-only concepts
app/(cockpit)/
  _layout.tsx               ← NativeTabs → 5 tabs (overview/revenue/analytics/health/settings)
  overview.tsx              ← NEW Overview screen (real build)
  revenue.tsx               ← placeholder "coming next"
  analytics.tsx             ← placeholder
  health.tsx                ← placeholder
  settings.tsx              ← placeholder
  (home)/ (growth)/ (reviews)/ more/   ← REMOVED after the above land
```

Each `liquid/` unit is presentational (props in, JSX out) - no data fetching, matching
the project rule that hooks own data and components stay pure. Screens compose hooks +
liquid primitives.

## Components

### Tokens (`tokens.ts`, additive)
- Align `bgBase` → `#07070A`; add `bgDeep #050507`.
- 4-step foreground: keep `fgPrimary #F5F5F0`; add `fg2 #C9C9BE`, `fg3 #8C8C94`, `fg4 #585860`
  (map onto existing fgSecondary/fgMuted/fgSubtle where they already match; add what's missing).
- Add `green #57E08B` (existing `accentInfo #7AA8FF` = prototype blue; `accentViolet`/`accentWarn`/`accentDanger` already match).
- `glass` recipe consts object: `{ tint: 0.055, blur: 26, border: 'rgba(255,255,255,0.10)', sheen: 0.12, radius: 28, radiusSm: 18, gap: 13 }`.

### `<LiquidGlass>`
Props: `{ children, tone?, radius?, padding?, glow?, deco?, onPress?, style? }`.
Renders `GlassView` (when `isLiquidGlassAvailable()`) else `BlurView` (intensity ~60, dark) as
the base, over it: white-tint fill (`rgba(255,255,255,0.055)`), top specular sheen
(176° linear gradient, white→transparent by 26%), inset hairline border, optional accent
`glow` spot (radial), optional `deco` slot (corner ticks), content wrapper. Preserves the
existing `tone` border/glow map. Replaces today's `liquid-glass.tsx` (same import path kept
for compatibility, re-exported).

### `<LiquidBackground>`
Skia `Canvas` absolute-filled behind scroll content:
- 4 radial-gradient blobs (lime/violet/blue/warn) with Skia `Blur` image filter (~60px),
  positions per prototype, animated via Reanimated shared values (`drift` 26–38s loops,
  transform-only so a frozen frame never blanks content).
- Blueprint grid: 32px line grid at `rgba(255,255,255,0.028)` with a radial mask fading
  downward (Skia or masked `View`).
- Grain overlay at ~4% opacity.
- Honors a `glow` intensity prop (default 0.9).

### Layout primitives
- `<OpenHero>` - eyebrow (+ optional live dot), big mono `CountUp` value + `<Delta>`,
  optional `<Ring>`, caption, area chart (or custom `chartEl`), optional mini-stat strip
  (`<MiniStat>` separated by `<Sep>`). Card-less - sits on the glass background.
- `<CardSection>` - indexed header (`01` mono + title + count badge + hairline rule +
  optional action link) + children, used inside a single big `<LiquidGlass pad={0}>` card.
  `<FullDivider>` between sections.
- `<Row>` - tappable header + animated chevron (rotate 90° on open) + reveal `detail`
  (Reanimated height/opacity). `<KV>` 2-col key/value grid for expanded details.
- `<ActionBtn>` (default/accent/danger tones), `<SearchInput>`, `<Seg>` (segmented
  control, full-width option), `<Delta>` (▲/▼ + colored %), `<Glyph>` (project badge),
  `<StatusDot>`, `<CornerTicks>`, `<CountUp>` (Reanimated count-up w/ timer fallback),
  `<EmptyHint>`.

### Charts (Skia)
`AreaChart` (smooth cubic path + vertical gradient fill + end dot), `Bars` (last
highlighted), `Ring` (animated stroke-dashoffset gauge), `HBar` (animated width fill,
starts at target if reduced-motion/hidden), `StackBar`, `Spark`. Animations via Reanimated.

### `<LiquidHeader>`
Single row: lime `h` logo tile + "helm" + pulsing sync dot · `<PropertyPicker>` (reuse
existing modal picker, restyled to glass pill) · bell pill with alert-count badge.

## Data flow - Overview screen

| Prototype block | Real source | Mapping / notes |
|---|---|---|
| Hero value + trend + delta | `useMetricDetail('ad_revenue')` (`today`, `series`) + derived delta | eyebrow "Revenue · all projects" |
| Live-active pill | `useCockpitKpis().dau` | labeled "ACTIVE" |
| Mini-stat DAU | `useCockpitKpis` `dau` / `dauDelta` | real |
| Mini-stat MRR | `useCockpitKpis` `mrr` / `mrrDelta` | real |
| Mini-stat Crash-free | `useSystemHealth` if it exposes it, else `demoData.crashFree` | tagged DEMO if derived |
| Monthly goal strip | `demoData.goal` | tagged DEMO |
| Projects list (filter All/Games/Apps/Web, expandable) | `useProperties` + `usePropertyMetricTotals` / `usePropertyDau` | real list; KV fields missing from hooks = DEMO |
| Project type filter | `Property.type` → All/Games(`game`)/Apps(`*_app`)/Web(`website`) | real |
| Needs attention (alerts, expandable, Resolve/Mute) | `useAlerts` + `useAckAlert` | Resolve = `delivered:true` mutation; Mute = local dismiss |

Loading → `<ScreenStatus label="Yükleniyor…">`; error → `tone="danger"`; empty groups →
`<EmptyHint>`. RefreshControl refetches KPIs + alerts (existing pattern).

`demo-data.ts` exports a single `demoData` object; each consumer renders a small `DEMO`
chip next to demo-sourced values.

## Error handling
- Hooks already return `{ isLoading, isError, data }`; screen guards before render
  (hooks-before-return rule preserved).
- Charts guard against empty/1-point series (render flat baseline, no crash).
- Glass falls back to BlurView when `isLiquidGlassAvailable()` is false.

## Testing
Per project rules (no test obsession; critical logic only, real data):
- Manual: `bun tsc --noEmit` clean, `expo-doctor` clean, app boots to Overview on device.
- Verify: hero count-up lands on final value, project rows expand, type filter narrows,
  alert Resolve calls the ack mutation and removes the row, GlassView renders on iOS 26
  and BlurView fallback below.
- No unit tests for presentational primitives (YAGNI); a complexity assertion is
  unnecessary here (all O(n) over ≤6-item sets).

## Complexity
- Lists: O(n) over bounded sets (≤6 projects/alerts). Filter is O(n). No nesting >2.
- Charts: O(points) path build, points ≤30.
- Background: 4 blobs + 1 grid, constant draw cost; Reanimated runs drift on the UI thread.
- No FlashList needed in Overview (sets are tiny); Health/Analytics later will use it for
  crash/dimension lists that can exceed ~50 rows.

## Migration / removal order
1. Add tokens + `liquid/` foundation + `demo-data.ts` (no behavior change yet).
2. Build `overview.tsx`.
3. Switch `_layout.tsx` to 5 tabs; add 4 placeholders.
4. Delete `(home)/(growth)/(reviews)/more` route trees + now-unused screen-only components
   (keep all hooks/components Overview still uses).
5. `bun tsc --noEmit` + boot check.
