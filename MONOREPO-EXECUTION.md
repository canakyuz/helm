# Helm Monorepo — Faz 0 Execution Spec (handoff)

> **Bu dosya kendi içinde tamdır.** Fresh-chat agent: önce §0–§3'ü oku, sonra §4'ü sırayla uygula.
> **Kapsam: SADECE Faz 0** — monorepo iskeleti, iki app de build yeşil, types tek kaynak.
> **YAPMA:** fetch logic extract (Faz 1), davranış değişikliği, yeni feature. Detay: §6.

---

## 0. Bağlam (önce bunu oku)

Helm = indie founder portfolio cockpit. Aynı Supabase hub'a bağlı **iki istemci**:
- **web** (Refine + Vite + React) — kurulum, admin, entegrasyon wizard.
- **mobile** (Expo SDK 56 + RN 0.85 + NativeWind v4 + expo-router) — sahada KPI/alert/widget.

Karar (ADR-001, kabul edildi): **tek UI değil** → monorepo + paylaşılan `@helm/*` paketleri, ayrı UI'lar.
İlgili plan dokümanları: `apps/mobile/docs/architecture/` (ADR-001, monorepo.md), `apps/mobile/docs/migration/` (phase-1-api-extract.md, hook-inventory.md). **Bu dosya onların Faz 0 execution'ı.**

Bu Faz 0'ın hedefi: kod TAŞIMADAN iskelet kur. İki app aynen eskisi gibi build olsun. Paketler boş scaffold. Mobile `@helm/*`'ı henüz **import etmez** (dependency tanımlı, kullanım yok).

---

## 1. Mevcut durum (kanıt — 2026-06-01)

| Path | Ne | Git | Not |
|------|-----|-----|-----|
| `priv/helm/` | **Yeni boş monorepo root** (hedef) | henüz git değil | bu dosya burada |
| `priv/helm-web/` | Web (Refine/Vite) + `supabase/` backend | repo, kendi branch'i | migration 0001–0031, edge functions burada |
| `priv/helm-mobile/` | Expo app | branch `feat/liquid-glass-overview`, **~12 kirli dosya** | taşımadan önce commit/stash ŞART |

Doğrulanmış gerçekler:
- Supabase project id: **`mqiwgorivtglnjbwhkve`** (remote, deploy edilmiş — migration 0030/0031 uygulandı).
- **Gerçek tipler zaten üretildi:** `helm-mobile/src/types/database.ts` (1226 satır, `gen:types` çıktısı). Bu, `packages/types`'ın kaynağı olacak.
- Mobile config: `metro.config.js` `withNativeWind` ile sarılı; `babel.config.js` `babel-preset-expo`+`nativewind/babel`+`react-native-worklets/plugin`; tsconfig alias `~/* → ./src/*`; `main: expo-router/entry`.
- Web: Refine + Vite, `supabase/` CLI projesi web repo'sunun içinde.

---

## 2. Hedef yapı

```
helm/                              ← monorepo root (bun workspaces)
├── apps/
│   ├── web/                       ← helm-web'den (Refine/Vite); supabase/ ÇIKARILIR (aşağı bak)
│   └── mobile/                    ← helm-mobile'dan (Expo)
├── packages/
│   ├── types/                     ← @helm/types  (database.ts tek kaynak)
│   ├── api/                       ← @helm/api    (Faz 1'de dolar; şimdi boş)
│   ├── queries/                   ← @helm/queries(Faz 1; boş)
│   ├── domain/                    ← @helm/domain (Faz 1; boş)
│   └── config/                    ← @helm/config (STALE_TIME vb.)
├── supabase/                      ← ROOT'a taşınır (her iki app'in paylaştığı backend)
│   ├── migrations/  functions/  config.toml
├── docs/                          ← iki repodaki docs/ birleştirilir
├── package.json                   ← workspaces: ["apps/*","packages/*"]
├── tsconfig.base.json
└── .github/workflows/ci.yml
```

**Kritik karar — `supabase/` ROOT'ta:** Backend'i web+mobile paylaşıyor, app'e ait değil. `helm-web/supabase` → `helm/supabase`. Edge function'ların iç `../_shared/...` relative path'leri klasör bütün taşındığı için bozulmaz. Web'in `supabase db push`/`gen:types` script'leri root'tan çalışacak şekilde güncellenir (§4.7).

---

## 3. Çözülmüş kararlar (3 çatal)

1. **Root & isim:** `helm/` zaten yeni boş root. `helm-web`→`apps/web`, `helm-mobile`→`apps/mobile`. (Eski `helm`→`helm-web` rename'i yapıldı; çakışma yok.)
2. **Git history:** `git subtree` ile iki repoyu da history KORUYARAK import et (§4.3). Basit alternatif (history kaybı): `rsync` + tek `git init` — sadece history umursamıyorsan.
3. **Metro (asıl risk):** Monorepo'da Expo Metro, hoisted/workspace paketlerini `watchFolders`+`nodeModulesPaths` olmadan ÇÖZEMEZ → §4.6'daki config ŞART. `withNativeWind` korunur.

---

## 4. Adımlar (sırayla)

### 4.0 — Pre-flight (zorunlu)
```bash
# Mobile kirli — temizle. (helm-mobile)
cd ~/Desktop/Projects/priv/helm-mobile
git status                      # 12 dosyayı gör
git add -A && git commit -m "chore(mobile): WES-000 monorepo taşıması öncesi snapshot"
# Web temiz mi?
cd ~/Desktop/Projects/priv/helm-web && git status   # kirliyse commit'le
```
**DoD:** Her iki repo `git status` temiz.

### 4.1 — Root'u git repo yap + workspaces
```bash
cd ~/Desktop/Projects/priv/helm
git init
mkdir -p apps packages
```
`helm/package.json`:
```json
{
  "name": "helm",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "typecheck": "bun run --filter '*' typecheck",
    "gen:types": "supabase gen types typescript --project-id $HELM_SUPABASE_PROJECT_ID --schema public > packages/types/src/database.ts",
    "db:push": "supabase db push",
    "fn:deploy": "supabase functions deploy"
  }
}
```
`.gitignore` (root): `node_modules`, `dist`, `.expo`, `*.log`, `.env*` (gitignore'da).

### 4.2 — `.env` taşı/birleştir
Web ve mobile `.env`'lerini root'a topla. Gerekli anahtarlar:
```
HELM_SUPABASE_PROJECT_ID=mqiwgorivtglnjbwhkve
# web (Vite):    VITE_HELM_SUPABASE_URL, VITE_HELM_SUPABASE_ANON_KEY
# mobile (Expo): EXPO_PUBLIC_HELM_SUPABASE_URL, EXPO_PUBLIC_HELM_SUPABASE_ANON_KEY
# ANON_KEY değeri yeni format olmalı (sb_publishable_...). Legacy JWT anon key 2026-08-17'de kapatıldı → "Legacy API keys are disabled" (401).
```
**Not:** Vite `apps/web`'de çalışırken `.env`'i app klasöründen okur (Vite default). Mobile `EXPO_PUBLIC_*`'ı app klasöründen okur. Yani her app'in kendi `.env`'i `apps/<app>/.env` olarak kalabilir; project-id'yi root `.env`'e koy (CLI script'leri için).

### 4.3 — İki repoyu subtree ile import et (history korunur)
```bash
cd ~/Desktop/Projects/priv/helm
# WEB  (helm-web'in aktif branch adını koy; örn main)
git subtree add --prefix=apps/web  ../helm-web  <WEB_BRANCH>
# MOBILE
git subtree add --prefix=apps/mobile ../helm-mobile feat/liquid-glass-overview
```
> Subtree çalışmazsa fallback: `rsync -a --exclude node_modules --exclude .git ../helm-web/ apps/web/` (+ mobile) → history gider ama temiz.

### 4.4 — `supabase/`'ı root'a çıkar
```bash
git mv apps/web/supabase supabase
# web'in supabase'e bağlı script'lerini güncelle (apps/web/package.json):
#   "gen:types" / "db:push" gibi script'ler artık root'tan çalışır → app'ten sil veya köke taşı.
```
`apps/web/package.json` içindeki `supabase ...` komutlu script'leri kaldır (root'a taşındı). `supabase/config.toml` + `.temp` root'ta kalır.

### 4.5 — `packages/*` iskeletleri (boş, derlenebilir)
Her paket: `package.json` + `tsconfig.json` + `src/index.ts`. Raw-TS yaklaşımı (build yok, consumer bundler transpile eder):

`packages/types/package.json`:
```json
{ "name": "@helm/types", "version": "0.0.0", "private": true,
  "main": "./src/index.ts", "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" } }
```
`packages/types/src/index.ts`: `export type { Database } from "./database";`
**Types tek kaynak:** `helm-mobile`'dan gelen gerçek tipi taşı:
```bash
cp apps/mobile/src/types/database.ts packages/types/src/database.ts
```
> Faz 0'da mobile HÂLÂ kendi `apps/mobile/src/types/database.ts`'ini kullanır (import değişmez). Faz 1'de mobile `@helm/types`'a geçer; o zaman mobile kopyası `export * from "@helm/types"` re-export'una iner. Şimdi iki kopya var — kabul (Faz 0 davranış değiştirmez).

`api`, `queries`, `domain`, `config` aynı şablon, `src/index.ts` boş `export {}`. Bağımlılıklar (peer/normal):
- `@helm/api` → `@helm/types`, `@supabase/supabase-js`
- `@helm/queries` → `@helm/api`, `@tanstack/react-query`
- `@helm/config/src/stale-time.ts`: `export const STALE_TIME = { kpis:30_000, alerts:30_000, audit:300_000, systemHealth:60_000, fxRates:3_600_000 } as const;`

### 4.6 — Mobile Metro monorepo config (ASIL RİSK — bunu atlama)
`apps/mobile/metro.config.js` (mevcut `withNativeWind`'i KORU, monorepo resolver EKLE):
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
```
Mobile `package.json` deps'e ekle (Faz 0'da KULLANILMAZ, sadece tanımlı):
```json
"@helm/types": "workspace:*", "@helm/api": "workspace:*",
"@helm/queries": "workspace:*", "@helm/domain": "workspace:*", "@helm/config": "workspace:*"
```

### 4.7 — Web (Vite) workspace transpile
Vite raw-TS workspace paketlerini externalize ETMEMELİ. `apps/web/vite.config.ts`:
```ts
// resolve.alias zaten varsa koru; ek:
optimizeDeps: { include: ["@helm/types","@helm/api","@helm/queries","@helm/domain","@helm/config"] },
// ssr yok (SPA) → ek externalize ayarı gerekmez; sorun çıkarsa:
// build.commonjsOptions / resolve.preserveSymlinks: true
```
Web `package.json`'a da `@helm/*: workspace:*` ekle (Faz 1'de kullanılacak).

### 4.8 — tsconfig
Root `tsconfig.base.json` (paths):
```json
{ "compilerOptions": {
    "strict": true, "skipLibCheck": true, "moduleResolution": "bundler",
    "paths": {
      "@helm/types": ["./packages/types/src/index.ts"],
      "@helm/api": ["./packages/api/src/index.ts"],
      "@helm/queries": ["./packages/queries/src/index.ts"],
      "@helm/domain": ["./packages/domain/src/index.ts"],
      "@helm/config": ["./packages/config/src/index.ts"]
} } }
```
`apps/mobile/tsconfig.json` ve `apps/web/tsconfig.json`: `"extends": "../../tsconfig.base.json"`, kendi `~/*`/baseUrl path'lerini KORU.

### 4.9 — Install + doğrula
```bash
cd ~/Desktop/Projects/priv/helm
bun install                                  # workspaces resolve, hatasız
cd apps/mobile && bun run typecheck          # YEŞİL (tsc --noEmit)
npx expo start -c                            # Metro bundle açılıyor mu (clear cache)
cd ../web && bun run build                   # Vite build YEŞİL
```

### 4.10 — CI + docs birleştir
`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck
```
`apps/web/docs` + `apps/mobile/docs` → root `docs/`'a birleştir (çakışan dosyaları manuel reconcile et; migration/architecture dokümanları mobile'dan gelir).

---

## 5. Tuzaklar (her birini kontrol et)

- **Metro (en sık kırılan):** §4.6 olmadan "Unable to resolve module" alırsın. `expo start -c` ile cache temizle.
- **NativeWind:** `global.css` + `babel.config.js` (nativewind/babel) `apps/mobile`'da kalır; metro `withNativeWind` korunmalı.
- **Worklets/Reanimated:** `react-native-worklets/plugin` babel'de KALMALI (taşırken babel.config.js'i bozma).
- **expo-router:** `apps/mobile/app/` dizini + `main: expo-router/entry` aynen taşınır; `app.json`/`app.config.*` scheme (`helmmobile://`) korunur.
- **EAS:** `eas.json` varsa `apps/mobile`'da kalır; EAS build'de monorepo için `eas.json`'a `"cli": { "appVersionSource": "remote" }` + build profilinde gerekirse root'a çıkan `node_modules` ayarı. (Faz 0 build'i bozmaz; EAS'i ayrıca test et.)
- **`~/*` alias:** mobile `./src/*`'a relative kalır, `apps/mobile` içinde çalışır — dokunma.
- **Vite externalize:** `@helm/*` paketleri raw TS; build'de "failed to resolve" gelirse §4.7 optimizeDeps + `resolve.preserveSymlinks: true`.
- **supabase scriptleri:** `db push`/`gen:types` artık ROOT'tan (`supabase/` root'ta). Web'in eski script'leri kaldırıldı.

---

## 6. Faz 0'da YAPMA (scope guard)

- ❌ Hook'lardan `supabase.from` çıkarma → **Faz 1**.
- ❌ `packages/api|queries|domain`'i doldurma → **Faz 1** (hook-inventory.md sırasıyla).
- ❌ Mobile'ı `@helm/*` import ettirme (deps tanımlı ama kullanılmaz).
- ❌ Web'in Refine query'lerine dokunma → **Faz 2**.
- ❌ Multi-tenant / RLS / org → **Faz 3**.
- ❌ Davranış/UI değişikliği. İki app **birebir eskisi gibi** çalışmalı.

---

## 7. Definition of Done

- [ ] `bun install` root'ta hatasız (workspaces resolve).
- [ ] `apps/mobile`: `bun run typecheck` yeşil + `expo start -c` bundle açılıyor.
- [ ] `apps/web`: `bun run build` yeşil.
- [ ] `packages/types/src/database.ts` gerçek schema (1226 satır) içeriyor.
- [ ] `supabase/` root'ta; `supabase db push --dry-run` (veya `supabase migration list`) çalışıyor.
- [ ] CI yeşil.
- [ ] Her iki app'in git history'si korundu (subtree) — `git log apps/mobile` eski commit'leri gösteriyor.
- [ ] Hiçbir davranış değişmedi (mobile ekranları + web sayfaları eskisi gibi).

→ Sonraki: `apps/mobile/docs/migration/phase-1-api-extract.md` (extract sırası tabloya göre).

---

## Ek — bu seansta yapılan ilgili işler (bağlam)
Son seansta `helm-web`'e eklenen ve mobile'da bağlanan gerçek-veri işleri (bunlar Faz 1 extract sırasını etkiler — yeni metrikler/edge'ler):
- metrics: `crash_free_sessions`, `mau`, `avg_session_sec`, `subscription_revenue`, `iap_revenue`, `subs_trial`.
- tablolar: `revenue_goals` (+`set_revenue_goal` RPC), `payouts`.
- edge'ler: `helm-retention`, `helm-os-breakdown`, `helm-mrr-movement`, `helm-payouts` (çok-kaynaklı: Stripe+ASC).
- mobile yeni hook'lar: `use-revenue-goal`, `use-payouts`, `use-revenue-mix`, `use-mrr-movement`, `use-analytics` (retention/os eklendi).
Bunlar Faz 1'de `@helm/api`'ye taşınırken `hook-inventory.md` tablosuna eklenmecek (envanter 2026-05-29'da donmuştu).
