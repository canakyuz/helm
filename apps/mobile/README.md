# helm-mobile

`helm` cockpit'inin **kişisel** mobil yoldaşı. Aynı Supabase'e bağlanır; sahada hızlı KPI + alert kontrolü için. TestFlight only.

> Proje kuralları: [`CLAUDE.md`](./CLAUDE.md)  
> Ürün stratejisi: [`docs/README.md`](./docs/README.md) — geçiş planı, entegrasyonlar, pazar analizi

## Kurulum

```bash
bun install

# .env'i doldur (helm/.env.local'dan kopyala, prefix değiştir)
cp .env.example .env
# EXPO_PUBLIC_HELM_SUPABASE_URL = helm hub URL
# EXPO_PUBLIC_HELM_SUPABASE_ANON_KEY = helm hub anon key
# EXPO_APPLE_TEAM_ID = Apple Developer Team ID (widget prebuild için)

# Tipleri üret (opsiyonel ama önerilir)
bun run gen:types
```

## Geliştirme

```bash
# iOS simulator
bun ios

# Expo Go ile QR
bun start
```

## TestFlight'a build

İlk seferki kurulum:

```bash
bun add -g eas-cli         # global
eas login                  # Apple ID
eas init                   # projectId üretir → app.config.ts'ye kopyala
eas device:create          # kendi iPhone'unu kaydet
```

Build + submit:

```bash
bun run build:preview      # eas build -p ios --profile preview (cloud — aylık kota)
bun run submit:preview     # son cloud build → TestFlight
```

Cloud kotası doluysa **yerel build + submit** (kota harcamaz):

```bash
make ios-local-release              # preview → dist/helm-ios-preview.ipa → TestFlight
make ios-local-build                # sadece IPA
make ios-submit IPA=./dist/foo.ipa  # mevcut IPA yükle
make EAS_PROFILE=production ios-local-release
```

JS-only OTA update (build yok, doğrudan kullanıcıya):

```bash
bun run update:preview -- --message "WES-XXX neden"
```

## iOS Home Widget (WidgetKit)

Bu proje `@bacons/apple-targets` ile iOS home widget extension üretir.

İlk kurulum:

```bash
# Native iOS proje üret (widget target dahil)
npx expo prebuild -p ios --clean

# iOS build
bun ios
```

Widget veri kaynağı:
- App tarafı payload yazımı: `src/lib/widget-sync.ts`
- Widget target config: `targets/widget/expo-target.config.js`
- Widget Swift kaynakları: `targets/widget/*`
- App Group: `group.com.canakyuz.helmmobile.shared` (main app + extension — `app.config.ts` `ios.entitlements`)
- Widget sizes (home): **Small / Medium / Large** = dark glass total revenue board
- Lock screen: **Inline** (`helm · ₺… · Δ%`) · **Rectangular** (total + ad/pay) · **Circular** (compact total + gauge)
- Add lock screen: long-press lock screen → Customize → Lock Screen → add **helm** widget
- Sync: `useWidgetSync()` in `app/(cockpit)/_layout.tsx` (any cockpit tab + app foreground)

### EAS build (app + widget extension)

Widget eklentisi ikinci bir iOS target olduğu için **ilk kez** credential kurulumu interaktif yapılmalı:

```bash
# 1) İki target için provisioning (helm + HelmWidgetExtension)
eas credentials -p ios

# veya doğrudan ilk production build (non-interactive OLMADAN)
eas build -p ios --profile production
```

Credential’lar hazır olduktan sonra CI/non-interactive çalışır:

```bash
eas build -p ios --profile production --non-interactive
eas submit -p ios --profile production --latest --non-interactive
```

`ios.appleTeamId` EAS ile aynı team: `AZPJSKX9C9`.

Apple Developer → Identifiers → **App Groups** (App IDs değil) → `group.com.canakyuz.helmmobile.shared` oluştur → `com.canakyuz.helmmobile` ve `com.canakyuz.helmmobile.helmwidgetextension` App ID’lerine bağla.

## Mimari

- **Route grupları:** `(auth)` ve `(cockpit)` — Expo Router
- **State:** TanStack Query (cache 30s, refetch on focus)
- **Auth:** Supabase magic link, token `expo-secure-store` (Keychain)
- **Styling:** NativeWind v4 + dark-only palette
- **Build:** EAS preview profile → internal TestFlight

## Sayfalar

| Tab | Dosya | İçerik |
|-----|-------|--------|
| Cockpit | `app/(cockpit)/index.tsx` | MRR, DAU, açık alert, son sync |
| Alerts | `app/(cockpit)/alerts.tsx` | Açık alertler |
| Properties | `app/(cockpit)/properties.tsx` | App/brand heartbeat |
| Audit | `app/(cockpit)/audit.tsx` | Son 100 aksiyon |
| Settings | `app/(cockpit)/settings.tsx` | Logout, sürüm |

## Bilinen TODO'lar

- `app.config.ts` içinde `projectId` ve update URL `eas init` sonrası doldurulacak
- `eas.json` içinde `ascAppId` App Store Connect'te app oluşturduktan sonra
- `src/types/database.ts` — `bun run gen:types` ile gerçek tipler üretilecek
- `useCockpitKpis` MRR/DAU şu an placeholder — helm hub'da `vw_cockpit_kpis` view'ı eklenince güncellenecek
