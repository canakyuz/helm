---
name: Helm
description: Founder-ops kokpiti — çoklu proje geliri, kullanıcı ve entegrasyon sağlığı tek panelde
colors:
  bg: "#F7F7F5"
  tile: "#FFFFFF"
  tile-2: "#F4F4F1"
  line: "#E9E9E5"
  fg: "#181A20"
  fg-muted: "#71737A"
  fg-faint: "#8F9198"
  primary: "#232A38"
  positive: "#16A34A"
  negative: "#DC2626"
  warning: "#D97706"
  chart-violet: "#7C3AED"
  chart-blue: "#2563EB"
  chart-amber: "#EA580C"
  bg-dark: "#0A0A0C"
  tile-dark: "#131318"
  tile-2-dark: "#1A1A21"
  line-dark: "#1F1F26"
  fg-dark: "#F6F6F1"
  fg-muted-dark: "#9E9EA4"
  primary-dark: "#E8EAF0"
  positive-dark: "#4ADE80"
  negative-dark: "#FB7185"
  warning-dark: "#FFB100"
typography:
  hero:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "19px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  eyebrow:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.16em"
rounded:
  field: "14px"
  icon: "13px"
  btn: "12px"
  inner: "16px"
  tile: "22px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  screenX: "16px"
  tileGap: "10px"
  tilePad: "18px"
  tilePadLg: "20px"
  rowY: "12px"
components:
  card:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.fg}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tilePad}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.btn}"
    height: "32px"
  input:
    backgroundColor: "transparent"
    rounded: "{rounded.field}"
    height: "32px"
---

## Overview

Helm, tek kurucunun (Can) birden fazla dijital ürünü tek panelden yönettiği bir "founder cockpit"
uygulaması. Tasarım dili "Kravio" adıyla anılan **flat** bir sistemdir: gölge/blur/cam efekti
bilinçli olarak yok (`src/styles/index.css` yorumu: *"Efekt yok"*), derinlik ring/border ve tonal
katmanla verilir. İki mod var — açık (varsayılan) ve koyu — CSS custom property override ile
(`[data-helm-theme="glass-dark"]`). Yazı tipi tek aile: Geist Variable. Font sayısı = 1 (mono
gerektiğinde `ui-monospace` sistem yığını, ayrı bir dosya/CDN import'u yok).

**Bilinen sapma:** `/login` sayfası bu ay yeniden tasarlanırken lime-green (`#c5f84b`) accent'i
tanıttı — bu renk yukarıdaki token setinde YOK, sadece login'in kendi CSS dosyasında (`auth.css`)
yaşıyor. Faz 1'de bu ya paylaşılan token setine taşınmalı ya da login'e özgü kalması bilinçli
olarak onaylanmalı; şu an ikisi de değil, sessiz bir tutarsızlık.

## Colors

Roller Material'daki gibi Primary/Secondary/Tertiary değil, **bento** adıyla anılan kendi
sözlüğüyle tanımlı: `bg` (zemin), `tile`/`tile-2` (kart yüzeyi, iki ton), `line` (border), `fg` /
`fg-muted` / `fg-faint` (üç kademeli metin), `primary` (tek accent — açıkta koyu lacivert
`#232A38`, koyuda açık gri `#E8EAF0` — birbirinin tersi, marka rengi yok, nötr kontrast).
Durum renkleri (`positive`/`negative`/`warning`) hem grafik hem rozet için ortak. `chart-*` üç
ek ton sadece veri görselleştirmede kullanılır, UI chrome'da değil.

Kontrast notu: `fg-faint` (`#8F9198` açık modda) gövde metninde kullanılmamalı — yalnızca üçüncül
etiketler için. Body text her zaman `fg` veya `fg-muted` olmalı (ikisi de ≥4.5:1 zemin üstünde).

## Typography

Tek aile: Geist Variable, sistem sans-serif fallback'i ile. Ölçek Material hiyerarşisine değil,
kendi "bento" adlandırmasına sahip: `eyebrow` (10px, HUD etiketleri) → `body` (13px, gövde) →
`title` (19px, kart başlığı) → `stat` (28px, KPI rakamı) → `hero` (48px, sadece login/marketing
anları). Sıkı negatif letter-spacing büyük punto'da standart (`hero`: -0.045em) — impeccable'ın
alt sınırı olan -0.04em'e yakın, daha sıkmamalı.

## Elevation

Gölge yok. Derinlik iki katmanlı yüzey tonuyla (`tile` vs `tile-2`) ve `ring-1 ring-foreground/10`
ile verilir (kutu gölgesi değil, ince bir dış çizgi). `login`'in koyu ekranındaki
`box-shadow: 0 0 65px rgba(197,248,75,.11)` (orbit core glow) bu kuralın **tek istisnası** —
dekoratif bir "canlı sinyal" efekti, genel bileşenlere sızdırılmamalı.

## Components

- **Card**: `rounded-tile` (22px terminolojik hedef; mevcut `Card` primitive'i hâlâ `rounded-xl`
  yani 14px kullanıyor — Faz 1'de bento-tile ölçeğine taşınması gündemde), `ring-1
  ring-foreground/10`, iç boşluk `tilePad`.
- **Button**: `rounded-btn` (12px), varyantlar: default (primary dolgu), outline, secondary,
  ghost, destructive, link. `:active` basınç geri bildirimi VAR (`translate-y-px`) — doğru,
  dokunulmadı. Düzeltilen: `transition-all` yerine kesin property listesi (emil-design-eng:
  "specify exact properties, avoid all").
- **Input**: `rounded-field` (14px), şeffaf zemin, `focus-visible` halkası `ring-3 ring-ring/50`.
- **Badge/rozet**: durum renkleri (`positive`/`negative`/`warning`) `size-1.5`/`size-2` nokta +
  metin ikilisi olarak kullanılıyor (bkz. `HealthBadge`, dashboard tablosu).

## Do's and Don'ts

- ✅ Tek accent (`primary`), tek font ailesi, ring-tabanlı derinlik.
- ✅ Durum renklerini (`positive`/`negative`/`warning`) tutarlı kullan — kırmızı hep `negative`,
  yeşil hep `positive`, farklı yerlerde farklı yeşil/kırmızı tonu icat etme.
- ❌ Blur/glassmorphism ekleme — proje bunu bilinçli olarak reddetti.
- ❌ Gradient text, side-stripe border, 22px'in üzerine keyfi radius artışı, ghost-card
  (border + geniş box-shadow ikilisi) — impeccable'ın genel yasak listesi burada da geçerli.
- ❌ Login'in lime-green'ini onaysız başka sayfalara sızdırma — ya sistemleştir ya login'e hapset.
- ❌ Mobile'ın "Liquid Glass" / native iOS dilini web'e taşıma — platformlar kasıtlı olarak ayrı.
