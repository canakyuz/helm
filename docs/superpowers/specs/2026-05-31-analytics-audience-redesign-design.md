# Analytics — Audience Redesign (harita + reviews) — Design

_2026-05-31 · WES-000 · "B layout" — sayı hero + DAU/WAU/MAU + harita bölümü + funnel + retention + reviews_

## Amaç
Analytics'i odaksız 5-liste yığınından, **kitle (audience) odaklı** profesyonel bir ekrana çevirmek:
"Kullanıcılarım kim, nereden geliyor, kalıyor mu, ne diyor?" Üç kart yönünün (audience/geo,
conversion/funnel, engagement/retention+reviews) hepsi tek ekranda. Gerçek veriyle.

## Kararlar (brainstorm'da netleşti)
- **Hero = B yönü:** büyük DAU sayısı + DAU/WAU/MAU **native segmented** (Expo UI) + bar grafik. (Mevcut hero zaten bu — korunur, segment native'e geçer.)
- **Harita:** `expo-maps` `AppleMaps.View` (iOS, key gerektirmez, dark). "Where" bölümü = canlı harita + ülke marker'ları, gerçek `metrics_country` verisinden (`useGeoBreakdown` zaten çekiyor). Tıklanınca ülke listesi/detay.
- **Reviews & ratings:** Health'ten **paylaşılan bileşene** çıkarılır, Analytics'e eklenir. **İkisinde de kalır** (tek kaynak, iki ekran — tekrar yok).
- **Bölüm sırası:** Hero → 01 Where (harita+ülkeler) → 02 Conversion funnel → 03 Acquisition → 04 Retention → 05 Reviews & ratings → 06 OS versions (ikincil, en altta).
- **Native segmented:** DAU/WAU/MAU `<Seg>` → `<NativeSegmented>`.

## Mimari (paylaşılan bileşenler)
```
src/components/liquid/audience-map.tsx   CREATE — <AudienceMap rows={GeoRow[]}> AppleMaps + country markers
src/components/liquid/reviews-section.tsx CREATE — <ReviewsSection> (rating+histogram+ReviewRows+reply)
                                          → Health + Analytics ikisi de import eder (tek kaynak)
app/(cockpit)/analytics.tsx              MODIFY — B layout: hero native seg, Where=map, + Reviews bölümü
app/(cockpit)/health.tsx                 MODIFY — inline Reviews kodunu <ReviewsSection> ile değiştir (davranış aynı)
src/lib/country-geo.ts                   CREATE — ISO-2 ülke kodu → {lat,lng,name} (marker konumu için, statik tablo)
```

### `<AudienceMap>`
- Props: `{ rows: GeoRow[] }` (country, country_name, users). projectId'yi Analytics çözer, geo hook'u zaten var.
- `AppleMaps.View` colorScheme=dark, cameraPosition dünya geneli (zoom düşük), `markers` = her ülke için `country-geo` tablosundan koordinat + `monogram`=ülke kodu + `title`=`${name} · ${users}`. tintColor accent.
- Yükseklik ~200px, liquid radius. Boş/iOS<18 marker click degrade: harita yine görünür, altında ülke listesi her zaman var (mevcut CountriesSection liste fallback).
- Performans: marker sayısı = ülke sayısı (≤~30), O(n). country-geo lookup O(1) Map.

### `<ReviewsSection>`
- Health'teki mevcut `ReviewItem` + `ReviewRows` + rating/histogram bloğunu birebir taşır (davranış değişmez: yıldız, histogram, satır aç/kapa, yanıt yaz/gönder via `useReviewReply`).
- Kendi `useReviews()` + `useReviewReply()` çağırır (self-contained). Analytics ve Health sadece `<ReviewsSection />` koyar.

### country-geo tablosu
- Statik `Record<string,{lat:number;lng:number;name:string}>` — yaygın ülkeler (US, TR, DE, GB, BR, JP, FR, IN, CA, AU…). Bilinmeyen kod → marker atlanır (liste yine gösterir). Web'de `country-geo.ts` var; aynı veriyi mobile'a küçük bir alt küme olarak alırız.

## Veri (hepsi gerçek, mevcut)
DAU/WAU/MAU/new users/stickiness/avg session → `useCockpitKpis`+`useMetricDetail`. Geo → `useGeoBreakdown`.
Funnel → `useFunnel`. Acquisition → `useAcquisition`. Retention → `useRetention`. OS → `useOsBreakdown`.
Reviews → `useReviews`+`useReviewReply`. (PostHog edge'leri tek-proje scope → "all" ise ilk projeye düşer; mevcut desen.)

## Hata/boş durumlar
Her bölüm zaten `isLoading`/empty guard'lı (mevcut). Harita: marker yoksa boş dünya + altında liste.
expo-maps iOS<18'de marker click yok → degrade kabul (harita + liste çalışır).

## Test / doğrulama
`bun run typecheck` temiz. Rebuild sonrası sim'de: harita render + marker'lar, DAU/WAU/MAU native seg,
Reviews hem Analytics hem Health'te aynı davranış. Screenshot ile gözle teyit.

## Kapsam dışı (YAGNI)
- Harita ısı haritası / polygon / cluster (marker yeter).
- Reviews filtreleme/sayfalama (mevcut ilk-6 yeter).
- OS bölümü genişletme (ikincil kalır).
