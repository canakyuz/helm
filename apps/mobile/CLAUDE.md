# helm-mobile — Proje Kuralları

Bu, `helm` cockpit'inin **kişisel** mobil yoldaşıdır. Refine masaüstünde kalır; bu uygulama sadece sahada/yolda hızlı KPI + alert kontrolü için. Kendi TestFlight'ından dağıtılır, App Store'a gitmez.

> Global kurallar: `~/.claude/CLAUDE.md` — kanıt önce yargı, algoritmik mükemmellik, polyrepo, no `any`, conventional commits + WES-XXX.

---

## 1) Amaç ve Kapsam

- **Tek kullanıcı:** Can. Multi-tenant değil, multi-user değil.
- **Veri kaynağı:** `helm` ile aynı Supabase projesi. Anon key + RLS.
- **Sadece okuma + hafif aksiyonlar:** Alert ack, settings. Veri yazma minimum.
- **TestFlight only:** App Store submission YOK. Internal testing track.
- **YAGNI:** Push notification ileride, çok dilli destek YOK, dark mode varsayılan ve tek.

## 2) Stack (sabit, değiştirme)

| Katman | Seçim | Sürüm |
|--------|-------|-------|
| Runtime | Expo | SDK 54 |
| Router | Expo Router (file-based) | 4.x |
| Dil | TypeScript strict | 5.x |
| Styling | NativeWind | v4 |
| Server state | TanStack Query | v5 |
| Storage | expo-secure-store | latest |
| Backend client | @supabase/supabase-js | v2 |
| Build | EAS Build | latest |
| Paket yöneticisi | bun | latest |

**Yasak:** Redux, MobX, Zustand (TanStack Query yeterli). Styled-components (NativeWind var). React Navigation manuel (Expo Router var). Axios (supabase-js + native fetch yeterli).

## 3) Klasör Yapısı (zorunlu)

```
helm-mobile/
├── app/                              ← Expo Router routes
│   ├── _layout.tsx                   ← root: QueryClientProvider, ThemeProvider, AuthGate
│   ├── index.tsx                     ← redirect → /login veya /(cockpit)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (cockpit)/
│       ├── _layout.tsx               ← Tabs
│       ├── index.tsx                 ← KPI ekranı
│       ├── alerts.tsx
│       ├── properties.tsx
│       ├── audit.tsx
│       └── settings.tsx
├── src/
│   ├── lib/                          ← cross-cutting infrastructure
│   ├── hooks/                        ← TanStack Query wrapper'ları
│   ├── components/                   ← saf UI (props in, JSX out)
│   │   └── ui/                       ← primitive (Button, Card, Badge)
│   ├── types/                        ← Supabase gen + manual types
│   └── theme/                        ← tokens (color, spacing)
├── assets/                           ← icon, splash, adaptive-icon
├── app.config.ts                     ← Expo config (dynamic, env okur)
├── eas.json                          ← Build profiles
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css
├── tsconfig.json
├── package.json
├── .env                              ← gitignored
├── .env.example
└── README.md
```

**Kurallar:**
- `app/` yalnızca route dosyaları içerir; logic `src/`'ye gider.
- `src/components/` saf sunum; veri fetch HOOK'larda olur.
- `src/hooks/` her biri tek query/mutation döner, side-effect yok.
- Dosya başına tek default export route, named export'lar `src/`'de.

## 4) Naming

- **Dosyalar:** kebab-case (`use-cockpit-kpis.ts`). İstisna: `app/` route dosyaları Expo Router convention'ına uyar (`_layout.tsx`).
- **Componentler:** PascalCase (`KpiCard`).
- **Hooks:** `use*` prefix, camelCase (`useCockpitKpis`).
- **Tipler:** PascalCase, suffix yok (`Alert`, `Property`). Supabase row tipleri: `T<TableName>Row` (`TAlertRow`).
- **Test ID'leri:** kebab-case (`testID="kpi-mrr"`) — Maestro/Detox için.

## 5) Routing (Expo Router)

- **Route groups:** `(auth)` ve `(cockpit)` URL'de görünmez, sadece layout grupları.
- **Tab bar:** sadece `(cockpit)/_layout.tsx` içinde. 5 sekme: Cockpit / Alerts / Properties / Audit / Settings.
- **Auth gate:** `app/_layout.tsx` içinde `useAuth()` → session yoksa `/login`'a redirect.
- **Deep link:** `helmmobile://` scheme, `app.config.ts` içinde tanımlı.

## 6) Veri Katmanı

### Supabase Client
- Tek instance: `src/lib/supabase.ts`.
- `expo-secure-store` adapter ile token persist (iOS Keychain).
- Anon key public, `.env`'den okunur (`EXPO_PUBLIC_HELM_SUPABASE_URL`, `EXPO_PUBLIC_HELM_SUPABASE_ANON_KEY`).

### Query patterns
- Her ekran 1-3 hook çağırır, başka data hook yok.
- `staleTime: 30s` varsayılan; KPI'lar için `30s`, audit için `5m`.
- `refetchOnReconnect: true`, `refetchOnAppFocus: true`.
- Mutation'lar `onSuccess` içinde `queryClient.invalidateQueries` çağırır.

### Tip Güvenliği
- `bun run gen:types` → `supabase gen types typescript` → `src/types/database.ts`.
- `Database` tipi import → row tiplerini türet, no `any`, no `unknown` çıkışı.

## 7) Styling

- **NativeWind v4** className. Inline style yasak (animasyon hariç).
- **Tokens:** `src/theme/tokens.ts` — semantic isimler (`bg-surface-1`, `text-fg-muted`). helm ile aynı palet.
- **Dark mode:** Sistem değil, varsayılan dark. Light mode YOK.
- **Spacing:** Sadece Tailwind scale (4'ün katları). Custom px değer YOK.
- **Safe area:** `react-native-safe-area-context` kullan, hardcoded padding YOK.

## 8) Performans

- **List virtualization:** 50+ item olan her liste `FlashList` veya `FlatList`. `ScrollView` ile uzun liste yasak.
- **Image:** `expo-image` (caching built-in), `<Image>` yasak.
- **Memoization:** `useMemo`/`useCallback` sadece ölçülmüş hot path'te.
- **Bundle:** `expo-doctor` temiz olmalı, unused deps yasak.

## 9) Auth

- **Magic link only.** Şifre yok, OAuth yok (V1).
- **Session persist:** SecureStore. Background'da token yenilenir.
- **Logout:** `supabase.auth.signOut()` + SecureStore clear.

## 10) Hata Yönetimi

- TanStack Query `error` state UI'a düşer. Toast yok, inline error gösterir.
- Network kaybı: Banner üstte, query otomatik retry.
- Supabase error: `error.message` user-facing değil — generic mesaj göster, console.log detay.

## 11) EAS / TestFlight Akışı

```bash
# İlk kurulum
eas init
eas device:create          # iPhone UDID register (development build için)

# Build (TestFlight'a)
eas build -p ios --profile preview

# Submit
eas submit -p ios --latest

# OTA update (JS-only değişiklikler)
eas update --branch preview --message "WES-XXX neden"
```

**eas.json profilleri:**
- `development` — dev client, simulator + device
- `preview` — internal distribution, TestFlight'a submit edilir
- `production` — KULLANMA (App Store için, kapsam dışı)

## 12) Environment

`.env` (gitignored):
```
EXPO_PUBLIC_HELM_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_HELM_SUPABASE_ANON_KEY=eyJ...
```

`EXPO_PUBLIC_*` prefix Expo'da client'a expose edilir. Service role key BURAYA YAZILMAZ.

## 13) Git

- Conventional commits + WES-XXX (global kuraldan miras).
- Scope: `mobile`, `mobile-auth`, `mobile-cockpit`, `mobile-alerts`, `mobile-build`.
- Örnek: `feat(mobile-cockpit): WES-000 KPI ekranı — MRR/DAU/aktif alert`.

## 14) Self-Review (her PR/commit öncesi)

1. ✓ `bun tsc --noEmit` temiz
2. ✓ `expo-doctor` temiz
3. ✓ No `any`, no `as` assertion (gerekli yerde justification yorumu)
4. ✓ Her ekran loading + error + empty state
5. ✓ Safe area + keyboard handling
6. ✓ `.env` commit edilmedi
7. ✓ Bundle size artışı <100KB (yeni dep eklediysen)
8. ✓ Karmaşıklık: hook'ta nesting <3, fonksiyon <20 satır
