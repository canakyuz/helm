# helm-mobile

`helm` cockpit'inin **kişisel** mobil yoldaşı. Aynı Supabase'e bağlanır; sahada hızlı KPI + alert kontrolü için. TestFlight only.

> Proje kuralları: [`CLAUDE.md`](./CLAUDE.md)

## Kurulum

```bash
bun install

# .env'i doldur (helm/.env.local'dan kopyala, prefix değiştir)
cp .env.example .env
# EXPO_PUBLIC_HELM_SUPABASE_URL = helm hub URL
# EXPO_PUBLIC_HELM_SUPABASE_ANON_KEY = helm hub anon key

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
bun run build:preview      # eas build -p ios --profile preview
bun run submit:preview     # TestFlight'a yükler
```

JS-only OTA update (build yok, doğrudan kullanıcıya):

```bash
bun run update:preview -- --message "WES-XXX neden"
```

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
