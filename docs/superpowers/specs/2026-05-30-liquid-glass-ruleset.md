# helm liquid glass - UI Ruleset (v1)

_2026-05-30 · WES-000 · feedback: "profesyonel değil, hızlar/compactlik" → hepsi + dengeli yoğunluk_

Bu ruleset bağlayıcıdır. Liquid-glass katmanındaki ve ekranlardaki **her** ölçü
buradan gelir. Keyfi/yarım px yasak. Amaç: **dengeli yoğunluk** - nefes alan ama
boş durmayan, hizalı, profesyonel bir analitik kokpit (referans his: Linear / Things /
iOS 26 native panel).

## 1. Spacing - tek skala (4pt grid)

Sadece şu değerler kullanılır. Aralarında değer yok.

```
space.xs2 = 2   space.xs = 4   space.sm = 8   space.md = 12   space.lg = 16   space.xl = 24
```

- Ekran section'ları arası dikey gap: **`md` (12)** - eski 18 değil.
- Kart iç padding: **`md` (12)**.
- Kart içi section üst padding: **`lg` (16)** baş, sonrakiler `md` (12); alt padding `sm` (8).
- Satır (Row) dikey padding: **10** (sabit istisna), min dokunma alanı 44'ü korur.
- KV / mini blok padding: **`sm` (8)**.
- Ekran kenar padding: **`lg` (16)**.
- Yatay element gap: `sm` (8) varsayılan, ikon+metin `xs`+ (6–8).

## 2. Tip skalası - 6 kademe, yarım punto yasak

```
type.label = 10   (mono, uppercase, eyebrow/etiket)
type.bodySm = 12  (ikincil metin, meta)
type.body  = 13   (birincil satır metni)
type.emph  = 15   (section/kart başlığı, vurgulu değer)
type.stat  = 20   (mini-stat değeri)
type.hero  = 40   (hero rakamı)
```

- Letter-spacing: label `+1.6` (uppercase), hero `-1`, başlık `-0.2`, gövde `0`.
- Line-height: metin ≈ 1.3; hero **44**; stat **24**.
- Mono = sayılar/etiketler (tabular), Sans = isimler/başlıklar.
- DEMO çipi tek istisna: 9px (mikro rozet).

## 3. Hero - taşma yasak

- Rakam `type.hero` (40), `lineHeight 44`, `letterSpacing -1`, **`numberOfLines={1}` +
  `adjustsFontSizeToFit`** → uzun para değerinde küçülür, asla taşmaz/kırpılmaz.
- Delta hero rakamının baseline'ına hizalı (`marginBottom 6`).
- Hero ile altındaki kart arası: section gap (`md` 12) - ekstra boşluk yok.
- Mini-stat şeridi: üst hairline + `md` padding-top; değer `type.stat`.

## 4. Radius

```
radius.lg = 22   (kart, hero kapsayıcı)   radius.md = 14   (iç bloklar, KV, butonlar)   radius.pill = 999
```

Eski 28 fazla yuvarlaktı; 22 daha enstrüman/pro.

## 5. Glass - daha az "yıkama", daha çok cam

```
glass.tint   = rgba(255,255,255,0.045)   (eski 0.055)
glass.sheen  = 0.08                       (eski 0.12)
glass.border = rgba(255,255,255,0.10)
glass.hairline = rgba(255,255,255,0.07)
```

GlassView (iOS 26) zaten materyal sağlar; fallback tint'i hafiflet. Sheen kartın
sadece üst ~22%'sinde, opacity 0.4.

## 6. Arka plan - içerik nettir, aurora atmosferdir

- Blob opacity **0.45** (eski 0.9) - içeriğin arkasında kalır, kontrastı bozmaz.
- Blur ≥ 60, alt fade güçlü (içeriğin olduğu orta-alt bölge neredeyse düz `bgBase`).
- Blueprint grid yalnızca üst ~%35'te belli olur.

## 7. Hizalama & ritim

- Tüm section başlıkları aynı bileşen, aynı boyut (`type.emph` 15), aynı hairline.
- Sayılar mono + tabular → kolonlar hizalı.
- Kart içi satırlar tek bir sol padding hizasında (16); ikon kolonu sabit genişlik.
- Bir ekranda en fazla 2 vurgu rengi + accent; gerisi nötr (fg kademeleri).

## 8. Hareket (dengeli, abartısız)

```
count-up: 800ms ease-out cubic        expand: 200ms        hbar fill: 700ms ease-out
chevron: 200ms        press: opacity 0.85, 120ms
```

Hepsi `useEffect` içinde (render-faz shared-value yazımı yasak - Reanimated).

## 9. Dokunma & erişilebilirlik

- Min dokunma 44×44 (görsel padding küçük olsa da hitSlop ile tamamla).
- Metin/zemin kontrast ≥ 4.5:1 (fgMuted #8C8C94 zeminde min 12px).

## Uygulama sırası
1. `tokens.ts` → `space`, `type`, güncel `glass`, `radius` eklenir.
2. `hero.tsx` → hero 40 + overflow guard + ritim.
3. `card.tsx` → başlık 15, paddingler skalaya.
4. `background.tsx` → blob opacity 0.45.
5. `glass.tsx` → tint/sheen güncel.
6. `overview.tsx` → section gap 12, hero chartH, skalaya hizala.
7. typecheck + cihazda gözle teyit.
