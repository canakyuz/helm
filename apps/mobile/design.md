# helm-mobile — Liquid Glass Design System

helm cockpit'inin **mobil** analitik yoldaşı. Sadece gelir değil; oyun/uygulama/web projeleri için
**ödemeler + analitik + crash sağlığı** tek panelde. iOS, koyu tema, gerçek iOS 26 liquid glass dili.

> Bu **mobil uygulamanın** (Expo / React Native / TypeScript) tasarım sistemidir — web prototipinin
> (`liquid.css` / `var(--*)` / `.jsx` / `window.HELM` / Tweaks paneli) DEĞİL. Token'lar
> `src/theme/tokens.ts`'te TS objeleri; cam `expo-glass-effect` ile; native kontroller `@expo/ui` +
> `expo-maps` ile. Bir token/bileşen adını yazmadan önce buradan veya `src/components/liquid/index.ts`
> barrel'ından doğrula — uydurma.

---

## 1. Tasarım İlkeleri

1. **Cam, içeriğin önüne geçmez.** Cam yüzeyler araç; rakamlar/aksiyonlar kahraman.
2. **Hassas alet hissi.** Editöryel indeksler (`01`,`02`), hairline ayraçlar, `CornerTicks`, mono+tabular rakamlar.
3. **Her satır işlevseldir.** `Row` genişler; içinde `ActionBtn` (resolve/refund/reply/mute), `KV` detay.
4. **Kartsız hero + tek büyük kart.** `OpenHero` cam zemine açık oturur; gerisi tek `LiquidGlass` kartında `CardSection`'larla indekslenir.
5. **Az ama büyük.** Veri-slop yok. Kaynağı olmayan metrik gösterilmez; gösterilirse `<DemoChip/>` ile işaretlenir.
6. **Native > custom.** Segment → `@expo/ui` SwiftUI Picker; harita → `expo-maps` Apple Maps. Platform idiomuna uy.

---

## 2. Renk — `colors` (`src/theme/tokens.ts`)

Inline kullanım: `import { colors } from "~/theme/tokens"` → `colors.accent`. NativeWind className de aynı paleti yansıtır.

### Yüzeyler
| Token | Hex | Kullanım |
|---|---|---|
| `bgBase` | `#07070A` | Ana arka plan |
| `bgDeep` | `#050507` | En derin |
| `bgSurface` | `#0E0E12` | Modal/sheet zemini |
| `bgElevated` | `#15151B` | Glass fallback (Android/iOS<26) |
| `bgHigher` | `#1C1C24` | Hover/pressed |

### Metin (4 kademe)
| Token | Hex | Kullanım |
|---|---|---|
| `fgPrimary` | `#F6F6F1` | Başlık, büyük rakam |
| `fgSecondary` | `#C9C9BE` | Satır etiketi, gövde |
| `fgMuted` | `#8C8C94` | Eyebrow, meta |
| `fgSubtle` | `#585860` | Placeholder, zaman damgası |

### Accent & semantik
| Token | Hex | Anlam |
|---|---|---|
| `accent` | `#D4FF4D` | **Marka lime** — CTA, pozitif, canlı |
| `accentInk` | `#11130A` | Accent dolgu üstü metin |
| `accentViolet` | `#B89CFF` | Abonelik / MRR |
| `blue` / `accentInfo` | `#7AA8FF` | Analitik / kullanıcılar |
| `green` | `#57E08B` | Sağlık / crash-free / başarı |
| `accentWarn` | `#FFB100` | Uyarı / degraded / DEMO çipi |
| `accentDanger` | `#FF5C7A` | Kritik / fatal / refund |

**Kural:** Yeni hex uydurma. Harmonik ton gerekirse alpha-suffix (`` `${colors.accent}40` ``) ya da `rgba(...)`. Her projeye tint olarak bu accent'lerden biri.

---

## 3. Tipografi

İki aile (`@expo-google-fonts/geist` + `geist-mono`, `useAppFonts()` ile yüklü):
- **Geist** — UI/başlık. Font ailesi adları string: `"Geist-400/500/600/700"`.
- **Geist Mono** — TÜM rakamlar/eyebrow/etiket/kod: `"GeistMono-400/500/600"`.

### Tip skalası — `type` (6 kademe, yarım punto YASAK)
| Token | px | Rol |
|---|---|---|
| `type.label` | 10 | Eyebrow (UPPERCASE, letterSpacing ~1.6), meta |
| `type.bodySm` | 12 | İkincil metin |
| `type.body` | 13 | Birincil satır metni |
| `type.emph` | 15 | Section/kart başlığı |
| `type.stat` | 20 | Mini-stat değeri |
| `type.hero` | 40 | Hero rakamı (`adjustsFontSizeToFit` ile taşma yok) |

Sayılar daima mono + tabular (RN'de Geist Mono zaten tabular akar). Eyebrow `<Eyebrow>` bileşeni.

---

## 4. Cam Sistemi — `<LiquidGlass>` (`src/components/liquid/glass.tsx`)

`var(--glass-*)` YOK. Reçete `glass` objesinde + GlassView/BlurView ile uygulanır.

### `glass` token (tokens.ts)
| Alan | Değer |
|---|---|
| `tint` | `rgba(255,255,255,0.045)` (fallback beyaz dolgu) |
| `border` | `rgba(255,255,255,0.10)` |
| `sheen` | `rgba(255,255,255,0.08)` (üst specular) |
| `hairline` | `rgba(255,255,255,0.07)` (satır ayracı) |
| `blurIntensity` | `60` (BlurView fallback) |
| `radius` / `radiusSm` | `22` / `14` |

### Render yolu
- iOS 26: `GlassView` (`expo-glass-effect`, `glassEffectStyle="regular"`, `colorScheme="dark"`).
- iOS<26: `BlurView` (`intensity 60`, `tint dark`). Android: `bgElevated` düz.
- **KRİTİK:** GlassView koyu zemin üstünde tek başına görünmez → **her zaman** üstüne beyaz-tint fill (`rgba(255,255,255,0.07)`) konur, yoksa kartlar kaybolur. (Bkz memory: liquid-glass-cards-need-fill.)
- Props: `tone` (default/lime/danger/warn/info/violet), `radius`, `padding`, `glow` (accent ışık lekesi), `deco` (CornerTicks slot), `onPress`, `style`.
- `LiquidGlass padding={0} style={{marginHorizontal:16}}` → tek büyük kart deseni.

### Arka plan — `<LiquidBackground>` (`background.tsx`, Skia)
4 drift aurora blob (accent/violet/blue/warn, opacity ~0.28–0.45) + blueprint grid + alta güçlü fade. `glow` prop yoğunluk.

---

## 5. Şekil & Boşluk

### `space` — 4pt skala (TEK izinli boşluk; keyfi/yarım px YASAK)
`xs2:2 · xs:4 · sm:8 · md:12 · lg:16 · xl:24`

- Ekran kenar padding: `16` (`space.lg`).
- Section'lar arası dikey gap: `12` (`space.md`).
- `radius` objesi: `lg:22 · md:14 · pill:999`.

---

## 6. Layout Sistemi (tüm sayfalarda ortak)

```
┌─ <LiquidHeader/> ── sync butonu · <PropertyPicker/> (Settings'te "SETTINGS") · bell
├─ <OpenHero/>     ── KARTSIZ: büyük mono rakam + Delta + grafik + 3 mini-stat şeridi
└─ <LiquidGlass padding={0} style={{marginHorizontal:16}}>
     <CardSection index="01" …/> <FullDivider/>
     <CardSection index="02" …/> …
[ native bottom tab bar — app/(cockpit)/_layout.tsx ]
```

- **`<OpenHero>`** (`hero.tsx`): `eyebrow`, `live`, `right` (segment/pill), `value`+`format` (`CountUp`), `delta`, `caption`, `chartData`/`chartEl`, `stats` (`HeroStat[]`, `MiniStat`+`Sep`), `ring`.
- **`<CardSection>`** (`card.tsx`): `index` + `title` + `count` + sağa solan hairline + `action`. `<FullDivider/>` ile ayrılır.
- **Header** tek satır; `LiquidHeader showPicker={false}` Settings'te picker'ı gizler.
- **Tab bar NATIVE** (`NativeTabs`, floating-pill değil) — 5 sekme, `tintColor: accent`.

---

## 7. Bileşenler (`src/components/liquid/` — barrel: `index.ts`)

### Grafikler (`charts.tsx`, Skia)
`AreaChart` (cubic + gradyan + uç nokta) · `Bars` (son bar vurgulu) · `Ring` (gauge) · `HBar` (animasyonlu yatay oran) · `StackBar` · `Spark`.

### Atomlar (`primitives.tsx`)
`Eyebrow` · `Delta` (▲/▼, `invert` ile "düşük iyi") · `Glyph` (tint monogram) · `StatusDot` · `CornerTicks` · `CountUp` (rAF + timer fallback) · `Seg` (custom segment) · `ActionBtn` (default/accent/danger) · `SearchInput` · `EmptyHint` · `DemoChip` (kaynaksız değer işareti) · `Stars` · `Toggle`.

### İşlevsel/layout
`Row` (genişleyen satır + Chevron) · `KV` (2-sütun detay) · `OpenHero`/`MiniStat`/`Sep` · `CardSection`/`FullDivider` · `LiquidHeader`.

### Native (rebuild gerektirir)
- **`NativeSegmented`** (`native-segmented.tsx`) — `@expo/ui` SwiftUI Picker `.segmented`. Custom `Seg` yerine tercih. ⚠️ `tag` modifier'dır (`<Text modifiers={[tag(o)]}>`), prop değil.
- **`AudienceMap`** (`audience-map.tsx`) — `expo-maps` `AppleMaps.View`. Rank-tint marker, akıllı kamera, flat/temiz stil. ⚠️ `colorScheme` enum (`AppleMaps.MapColorScheme.DARK`), marker callout iOS<18'de yok. `fill` prop full-bleed.
- **`ReviewsSection`** (`reviews-section.tsx`) — rating + histogram + reply; Analytics + Health ikisinde de kullanılır (tek kaynak).

### Compat
`src/components/ui/liquid-glass.tsx` → `LiquidGlassPanel` eski API'yi `LiquidGlass`'a yönlendiren shim.

---

## 8. Hareket (Reanimated; CSS yok)

| Anim | Süre | Kullanım |
|---|---|---|
| FadeIn (giriş) | ~420ms | Blok/hero girişi |
| Row expand | ~220ms | Satır açılımı (Chevron rotate) |
| HBar fill | ~700ms ease-out | Yatay oran dolumu |
| CountUp | ~800ms | Rakam sayma (+ timer fallback) |
| spin | ~900ms linear | Sync ikonu (withRepeat) |
| press | ~120ms | Pressable `opacity 0.85` |

⚠️ **Reanimated kuralı:** shared-value'yu **render sırasında yazma** — `useEffect` içinde yaz (yoksa uyarı/jitter). `Pressable`'ın `style`'ını fonksiyon yapma; `flexDirection:"row"` fonksiyon-style'da uygulanmaz → statik style kullan (bkz memory: pressable-function-style-flexdirection).

---

## 9. Bilgi Mimarisi — 5 sekme

`app/(cockpit)/`: **Overview · Revenue · Analytics · Health · Settings** (native tab bar).

- **Overview** — gelir hero + canlı aktif + aylık hedef + tip-filtreli Projects (`NativeSegmented`) + Alerts (resolve/ack).
- **Revenue** *(ana odak)* — dönem `NativeSegmented` hero; kart-içi `NativeSegmented` Mix/Subs/Payouts. (By platform / recent payments kaldırıldı — kaynak yok.)
- **Analytics** — DAU hero (DAU/WAU/MAU `NativeSegmented`); Top countries, funnel, acquisition, retention, **ReviewsSection**, OS. Harita: `AudienceMap`.
- **Health** — crash-free hero; crashes (resolve/ignore/Sentry), integrations, app versions, heartbeat, **ReviewsSection**.
- **Settings** — workspace, data sources (gerçek system-health), alerts, appearance (currency persist), sync, about.

---

## 10. Veri (hibrit — gerçek + tagged demo)

Gerçek: Supabase hook'ları (`useCockpitKpis`, `useMetricDetail`, `useAlerts`, `useProperties`,
`useSentryIssues`, `useSystemHealth`, `useReviews`, `useAcquisition`/`useFunnel`/`useGeoBreakdown`/`useRetention`/`useOsBreakdown`,
`usePropertyMetrics`, `usePayouts`/`useRevenueMix`/`useMrrMovement`). PostHog edge'leri tek-proje scope → "all" ise ilk projeye düşer.

Kaynağı olmayan kalemler `src/lib/demo-data.ts`'te; her demo değer yanında `<DemoChip/>`. Backend connector'ları
deploy edilince ilgili demo→gerçek geçişi mobilde sadece hook değişimiyle olur (kontratlar
`docs/superpowers/specs/2026-05-30-helm-backend-work-orders.md`).

---

## 11. Dosya Yapısı

| Yol | İçerik |
|---|---|
| `src/theme/tokens.ts` | `colors` · `fonts` · `glass` · `space` · `type` · `radius` |
| `src/components/liquid/` | Tüm tasarım sistemi bileşenleri (+ `index.ts` barrel) |
| `src/hooks/` | TanStack Query veri hook'ları (her biri tek query) |
| `src/lib/` | supabase, preferences, format, haptics, demo-data, country-geo |
| `app/(cockpit)/*.tsx` | 5 ekran (`_layout.tsx` = NativeTabs) |
| `app/(auth)/login.tsx` | Liquid glass login |
| `docs/superpowers/specs/` | spec'ler + liquid-glass-ruleset + backend work orders |

---

## 12. Yapma / Yap

**Yapma:** `var(--*)` (web token'ı — yok) · `.jsx`/`window.HELM` · yeni hex uydurma · yarım punto / keyfi px (sadece `space` skalası) · GlassView'i fill'siz bırakma (kart kaybolur) · `Pressable` fonksiyon-style'da `flexDirection` · render'da shared-value yazma · kaynaksız değeri DemoChip'siz gösterme · emoji ikon · gradyan buton spam.

**Yap:** `colors`/`type`/`space`/`glass`/`radius` token'ları · `space` skalası boşluk · mono+tabular rakam · native bileşen (NativeSegmented/AudienceMap) tercih · her satırı `Row` ile işlevsel · cam üstünde içeriği kahraman tut · editöryel `index`+hairline ritmi · değişiklikten sonra `bun run typecheck` + sim'de gözle doğrula (`curl localhost:8081/reload` + `xcrun simctl io booted screenshot`).
