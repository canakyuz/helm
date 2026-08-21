# TRON Rocket Cockpit Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web login ekranını, referanslardaki premium split-login netliğini koruyan; ilk bakışta stilize bir roket kokpiti olarak okunan; açık/koyu tema ve TR/EN kombinasyonlarının tamamında çalışan bir auth deneyimine dönüştürmek.

**Architecture:** Login route'u kod bölünmüş kalır. `LoginPage` yalnızca Refine auth durumunu ve sayfa kompozisyonunu yönetir; form, dil seçici ve kokpit görseli ayrı bileşenlerdir. Kokpit iki yerel AVIF/WebP asset ve sabit sayıda DOM/SVG HUD katmanından oluşur. Motion yalnızca auth chunk'ında yüklenir, pointer parallax React state kullanmaz. Çeviri metinleri provider'dan ayrılmış kaynak dosyasında tutulur.

**Tech Stack:** React 19, TypeScript strict, Vite 6, Refine `useLogin`, Supabase Auth, Tailwind CSS 4 + route-scoped CSS, Lucide React, `motion@13.1.1`, `sharp@0.35.3`, Bun test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-tron-rocket-cockpit-auth-design.md`

## Global Constraints

- Proje kuralı gereği test-first yoktur: her küçük davranış önce uygulanır, sonra yalnızca kritik regresyon testi eklenir.
- Runtime'da Unsplash, CDN, WebGL, canvas render loop veya üçüncü parti görsel isteği yoktur.
- Repoya master PNG alınmaz; yalnızca son AVIF/WebP dosyaları ve tekrar üretilebilir prompt kaydı alınır.
- Auth ekranındaki bütün kullanıcı metinleri `auth.*` i18n anahtarından gelir. Asset içinde yazı bulunmaz.
- Public signup, OAuth, remember-me ve hazır olmayan şifre sıfırlama bağlantısı eklenmez.
- Refine/Supabase auth provider sözleşmesi değiştirilmez; ham provider hatası UI'a veya console'a yazılmaz.
- `login.tsx` hedefi en fazla 80 satırdır; fonksiyonlar 20 satırı ve nesting depth 3'ü aşmaz.
- Görsel dekorasyon sabit eleman sayısındadır: render zamanı ve ek bellek `O(1)`.
- E-posta normalizasyonu/doğrulaması `O(n)` zamanda çalışır; `n` e-posta uzunluğudur. Döndürülen normalize string çıktı sayıldığında alan `O(n)`, yardımcı alan `O(1)`'dir.
- Commit formatı `type(scope): WES-000 Türkçe açıklama`; `--no-verify` ve `Co-Authored-By` yoktur.
- Her task sonunda yalnızca o task'ın dosyaları stage edilir; kullanıcıya ait alakasız değişikliklere dokunulmaz.

## Hedef Dosya Yapısı

| Dosya | Sorumluluk | Task |
|---|---|---|
| `apps/web/package.json` | Kesin paket sürümleri ve asset komutları | 1 |
| `apps/web/bun.lock` | Tekrarlanabilir bağımlılık çözümü | 1 |
| `apps/web/scripts/optimize-auth-assets.mjs` | Master görseli AVIF/WebP'e dönüştürme | 1 |
| `apps/web/scripts/check-auth-assets.mjs` | Boyut, format ve ölçü bütçesi | 1 |
| `docs/design/auth-cockpit-image-prompts.md` | Tekrar üretilebilir final art direction | 2 |
| `apps/web/public/auth/cockpit-{light,dark}.{avif,webp}` | Tema bazlı final görseller | 2 |
| `apps/web/src/lib/i18n/messages.ts` | TR/EN harici metin kaynağı | 3 |
| `apps/web/src/lib/i18n.tsx` | Locale state, saklama ve `<html lang>` | 3 |
| `apps/web/src/components/auth/credentials.ts` | Saf normalize + validation | 3 |
| `apps/web/src/components/auth/credentials.test.ts` | Kritik validation regresyonları | 3 |
| `apps/web/src/lib/i18n/messages.test.ts` | Kritik auth çeviri eşitliği | 3 |
| `apps/web/src/components/auth/language-toggle.tsx` | Erişilebilir TR/EN seçici | 4 |
| `apps/web/src/components/auth/login-form.tsx` | Alanlar, validation, hata ve submit | 4 |
| `apps/web/src/components/auth/cockpit-visual.tsx` | Picture, HUD ve Motion parallax | 5 |
| `apps/web/src/pages/login.tsx` | Refine auth state ve kompozisyon | 6 |
| `apps/web/src/styles/auth.css` | Auth layout, tema ve responsive kuralları | 6 |
| `apps/web/src/styles/index.css` | Eski login/orbit kurallarını kaldırma | 6 |

---

### Task 1: Paketleri ve deterministik asset pipeline'ını ekle

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/bun.lock`
- Create: `apps/web/scripts/optimize-auth-assets.mjs`
- Create: `apps/web/scripts/check-auth-assets.mjs`

**Interfaces:**
- Consumes: komut satırından `<master-path> <light|dark>`.
- Produces: `public/auth/cockpit-<theme>.avif` ve `.webp`.
- Invariant: her çıktı `1800×1200`; AVIF en fazla `280 KiB`, WebP en fazla `420 KiB`.

- [ ] **Step 1: Kesin bağımlılıkları ekle**

`apps/web` içinde çalıştır:

```bash
bun add --exact motion@13.1.1
bun add --dev --exact sharp@0.35.3
```

Beklenen: `package.json` içinde caret içermeyen `"motion": "13.1.1"` ve `"sharp": "0.35.3"`; `apps/web/bun.lock` güncellenir. `motion` React 19 peer aralığını destekler; `sharp` yalnızca geliştirme bağımlılığıdır.

- [ ] **Step 2: Package script'lerini ekle**

`apps/web/package.json` içindeki `scripts` nesnesine:

```json
"assets:auth": "node scripts/optimize-auth-assets.mjs",
"check:auth-assets": "node scripts/check-auth-assets.mjs"
```

- [ ] **Step 3: Optimize script'ini oluştur**

`apps/web/scripts/optimize-auth-assets.mjs`:

```js
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const [masterPath, theme] = process.argv.slice(2);
const themes = new Set(["light", "dark"]);

if (!masterPath || !themes.has(theme)) {
  throw new Error("Kullanım: bun run assets:auth <master-path> <light|dark>");
}

const outputDirectory = resolve("public/auth");
const outputStem = resolve(outputDirectory, `cockpit-${theme}`);
const baseImage = sharp(resolve(masterPath)).resize(1800, 1200, {
  fit: "cover",
  position: "attention",
});

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  baseImage.clone().avif({ quality: 58, effort: 6 }).toFile(`${outputStem}.avif`),
  baseImage.clone().webp({ quality: 76, smartSubsample: true }).toFile(`${outputStem}.webp`),
]);
```

Guard clause eksik argümanda yazma işlemi başlamadan çıkar. İki bağımsız encode `Promise.all` ile paralel yürür. Piksel işleme zamanı `O(w×h)`, Sharp pipeline belleği libvips tile/stream davranışına bağlıdır ve tam ham raster kopyasını uygulama JS heap'inde tutmaz.

- [ ] **Step 4: Asset bütçe script'ini oluştur**

`apps/web/scripts/check-auth-assets.mjs`:

```js
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const variants = [
  ["light", "avif", 280 * 1024],
  ["light", "webp", 420 * 1024],
  ["dark", "avif", 280 * 1024],
  ["dark", "webp", 420 * 1024],
];

for (const [theme, format, byteLimit] of variants) {
  const filePath = resolve(`public/auth/cockpit-${theme}.${format}`);
  const [{ size }, metadata] = await Promise.all([stat(filePath), sharp(filePath).metadata()]);

  if (size > byteLimit) throw new Error(`${filePath}: ${size} > ${byteLimit} byte`);
  if (metadata.width !== 1800 || metadata.height !== 1200) {
    throw new Error(`${filePath}: beklenen ölçü 1800x1200`);
  }
}

console.info("Auth asset bütçesi doğrulandı.");
```

Dört sabit varyantta çalışma `O(1)` dosya sayısıdır; metadata okuma dosya başına sabit header maliyetidir. Script PII veya dosya içeriği loglamaz.

- [ ] **Step 5: Pipeline dosyalarını doğrula**

Run:

```bash
cd apps/web
bun run typecheck
```

Beklenen: yeni TypeScript hatası yok. Assetler henüz üretilmediği için bu task'ta `check:auth-assets` çalıştırılmaz.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock apps/web/scripts/optimize-auth-assets.mjs apps/web/scripts/check-auth-assets.mjs
git commit -m "build(web-auth): WES-000 kokpit asset hattını ve motion paketini ekle"
```

---

### Task 2: Final kokpit illüstrasyonlarını üret ve optimize et

**Files:**
- Create: `docs/design/auth-cockpit-image-prompts.md`
- Create: `apps/web/public/auth/cockpit-light.avif`
- Create: `apps/web/public/auth/cockpit-light.webp`
- Create: `apps/web/public/auth/cockpit-dark.avif`
- Create: `apps/web/public/auth/cockpit-dark.webp`

**Interfaces:**
- Görsel girişinde metin/logo/insan yoktur; Helm `h` işareti sonradan DOM katmanında çizilir.
- Sol yüzdeki merkez konu; `object-position: 52% 50%` masaüstü ve `50% 42%` mobil kırpmada okunur kalmalıdır.
- Light ve dark aynı kamera, konsol ve pencere geometrisini paylaşır; yalnızca ışık/palet değişir.

- [ ] **Step 1: Prompt kaydını yaz**

`docs/design/auth-cockpit-image-prompts.md` içine aşağıdaki art direction ve iki varyantı kaydet:

```md
# Helm Auth Cockpit Image Prompts

## Ortak yön
Premium stylized 3D illustration of a compact rocket cockpit seen from the pilot's
seat, large panoramic forward window, one elegant planet and thin orbital horizon,
rounded tactile flight console in the foreground, two restrained translucent HUD
panels, soft cel-shaded volumes, polished product-render composition, cinematic but
friendly, sophisticated adult SaaS visual language, subtle cyan circuit accents,
gentle depth, clean geometry, ample negative space, no people, no astronaut, no
readable text, no letters, no logo, no watermark, no photorealism, no comic outline,
no gritty military hardware, no clutter, no red warning state, 3:2 landscape.

## Light varyant eki
Pearl-white and pale stone cockpit shell, powder blue and lavender space light,
graphite controls, restrained cyan HUD glow, one tiny lime status light, bright airy
background, soft shadows, premium frosted materials, clear silhouette at low contrast.

## Dark varyant eki
Deep navy cockpit shell, electric cyan HUD glow, muted violet ambient light, one tiny
lime status light, starless dark orbital background, readable midtone surfaces, soft
rim lights, blacks lifted enough to preserve console geometry, no crushed shadows.
```

- [ ] **Step 2: Image generation skill ile light master üret**

`imagegen` skill'i kullan. Ortak yön + light eki tek prompt olarak ver. Çıktıyı önce görsel olarak incele; aşağıdaki dört kriter aynı anda sağlanmıyorsa final kabul etme:

1. İlk bakışta ön cam + konsol nedeniyle roket kokpiti okunuyor.
2. Stilize 3D/cel-shaded; fotoğraf veya çocuk çizgi filmi değil.
3. Asset içinde yazı, harf, logo veya insan yok.
4. Sol panel kırpmasında gezegen ve ana kontrol kaybolmuyor.

Master çıktıyı repoya değil `/tmp/helm-auth-cockpit-light-master.png` yoluna kopyala.

- [ ] **Step 3: Dark master'ı aynı kompozisyonda üret**

Light master'ı image edit referansı olarak kullan ve yalnızca dark varyant ekindeki malzeme/ışık değişikliklerini iste. Kamera ve geometri değişmemeli. Master'ı `/tmp/helm-auth-cockpit-dark-master.png` yolunda tut.

- [ ] **Step 4: Dört final asset'i üret**

`apps/web` içinde:

```bash
bun run assets:auth /tmp/helm-auth-cockpit-light-master.png light
bun run assets:auth /tmp/helm-auth-cockpit-dark-master.png dark
bun run check:auth-assets
```

Beklenen: `Auth asset bütçesi doğrulandı.` Boyut limiti aşılırsa çözünürlüğü düşürme; önce AVIF kaliteyi 54'e, WebP kaliteyi 72'ye indirip tekrar üret. Görünür banding oluşursa asset kabul edilmez ve daha sade master üretilir.

- [ ] **Step 5: Gerçek dosyaları gözle doğrula**

AVIF ve WebP fallback'lerden en az birini doğrudan aç. Koyu görselde konsolun gövdesi kaybolmamalı; light görselde HUD çizgileri beyaza karışmamalı. Master PNG'lerin `git status` içinde görünmediğini teyit et.

- [ ] **Step 6: Commit**

```bash
git add docs/design/auth-cockpit-image-prompts.md apps/web/public/auth/cockpit-light.avif apps/web/public/auth/cockpit-light.webp apps/web/public/auth/cockpit-dark.avif apps/web/public/auth/cockpit-dark.webp
git commit -m "feat(web-auth): WES-000 stilize roket kokpiti görsellerini ekle"
```

---

### Task 3: Auth i18n kaynağını ve saf credential doğrulamasını kur

**Files:**
- Create: `apps/web/src/lib/i18n/messages.ts`
- Modify: `apps/web/src/lib/i18n.tsx`
- Create: `apps/web/src/lib/i18n/messages.test.ts`
- Create: `apps/web/src/components/auth/credentials.ts`
- Create: `apps/web/src/components/auth/credentials.test.ts`

**Interfaces:**

```ts
export type Locale = "tr" | "en";
export function translate(locale: Locale, key: string): string;

export interface LoginCredentials { email: string; password: string }
export type CredentialResult =
  | { ok: true; value: LoginCredentials }
  | { ok: false; reason: "invalid_credentials" };
export function validateCredentials(email: string, password: string): CredentialResult;
```

- [ ] **Step 1: Mesajları harici kaynağa taşı**

Mevcut `TRANSLATIONS` nesnesini `apps/web/src/lib/i18n/messages.ts` içine taşı. Eski anahtarları aynen koru ve auth için kimlik tabanlı şu anahtarları iki dilde eksiksiz ekle:

```ts
export type Locale = "tr" | "en";

export const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  tr: {
    "auth.language.label": "Dil seçimi",
    "auth.language.switchToEnglish": "İngilizceye geç",
    "auth.language.switchToTurkish": "Türkçeye geç",
    "auth.brand.label": "Helm giriş",
    "auth.eyebrow": "Güvenli görev erişimi",
    "auth.title": "Tekrar hoş geldin.",
    "auth.subtitle": "Kokpitine devam etmek için bilgilerini gir.",
    "auth.email.label": "E-posta",
    "auth.email.placeholder": "ad@şirket.com",
    "auth.password.label": "Şifre",
    "auth.password.hint": "En az 6 karakter",
    "auth.password.show": "Şifreyi göster",
    "auth.password.hide": "Şifreyi gizle",
    "auth.submit": "Giriş yap",
    "auth.submitting": "Kontrol ediliyor…",
    "auth.error.validation": "Geçerli bir e-posta ve en az 6 karakter şifre gir.",
    "auth.error.provider": "E-posta veya şifre hatalı. Tekrar dene.",
    "auth.security": "Özel çalışma alanı · Supabase Auth",
    "auth.visual.status": "Yörünge bağlantısı hazır",
  },
  en: {
    "auth.language.label": "Language selection",
    "auth.language.switchToEnglish": "Switch to English",
    "auth.language.switchToTurkish": "Switch to Turkish",
    "auth.brand.label": "Helm sign in",
    "auth.eyebrow": "Secure mission access",
    "auth.title": "Welcome back.",
    "auth.subtitle": "Enter your details to continue to your cockpit.",
    "auth.email.label": "Email",
    "auth.email.placeholder": "name@company.com",
    "auth.password.label": "Password",
    "auth.password.hint": "At least 6 characters",
    "auth.password.show": "Show password",
    "auth.password.hide": "Hide password",
    "auth.submit": "Sign in",
    "auth.submitting": "Checking…",
    "auth.error.validation": "Enter a valid email and a password of at least 6 characters.",
    "auth.error.provider": "Incorrect email or password. Try again.",
    "auth.security": "Private workspace · Supabase Auth",
    "auth.visual.status": "Orbital link ready",
  },
};

export const translate = (locale: Locale, key: string): string =>
  TRANSLATIONS[locale][key] ?? key;
```

Yukarıdaki blok auth eklerini gösterir; mevcut global İngilizce sözlüğü de aynı `en` nesnesinde korunmalıdır. Türkçe global anahtarların fallback davranışı değişmez.

- [ ] **Step 2: Provider'ı saf kaynağa bağla ve document dilini senkronize et**

`apps/web/src/lib/i18n.tsx` içindeki inline sözlüğü kaldır, `Locale` ve `translate` import et. `setLocale` yalnızca state değiştirir; localStorage ve DOM side-effect'lerini effect'e al:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Locale } from "@/lib/i18n/messages";

// context tanımı değişmeden kalır

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    window.localStorage.setItem("helm.locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t: (key: string) => translate(locale, key) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
```

`readInitialLocale` guard clause ile yalnızca `tr`/`en` kabul eder ve localStorage erişimi başarısızsa `tr` döner. İlk render sonrası `<html lang>` daima güncellenir; önceki kodun yalnızca dil butonuna basınca güncelleme kusuru kapanır.

- [ ] **Step 3: Credential doğrulamasını uygula**

`apps/web/src/components/auth/credentials.ts`:

```ts
export interface LoginCredentials {
  email: string;
  password: string;
}

export type CredentialResult =
  | { ok: true; value: LoginCredentials }
  | { ok: false; reason: "invalid_credentials" };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 6;

export function validateCredentials(email: string, password: string): CredentialResult {
  const normalizedEmail = email.trim().toLowerCase();
  const isValidEmail = EMAIL_PATTERN.test(normalizedEmail);

  if (!isValidEmail || password.length < MINIMUM_PASSWORD_LENGTH) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return { ok: true, value: { email: normalizedEmail, password } };
}
```

Fonksiyon global state değiştirmez. Regex ve normalizasyon `O(n)` zaman; dönüş string'i hariç `O(1)` yardımcı alan. Şifre kopyalanmaz ve loglanmaz.

- [ ] **Step 4: Yalnızca kritik regresyon testlerini ekle**

`credentials.test.ts` içinde Bun'ın `describe/expect/test` API'siyle şu dört davranışı test et:

1. Email trim + lowercase edilir, şifre değişmeden döner.
2. Boş/geçersiz email reddedilir.
3. Beş karakter şifre reddedilir, altı karakter kabul edilir.
4. Sonuç ham input'u mutate etmez.

`messages.test.ts` içinde `AUTH_KEYS` sabit listesindeki 19 anahtarın hem `tr` hem `en` için anahtarın kendisine düşmediğini ve `translate("tr", "unknown")` fallback'inin değişmediğini test et. Test lookup'ları `O(k)`; `k=19` sabit auth anahtarıdır.

- [ ] **Step 5: Kritik test ve typecheck çalıştır**

```bash
cd apps/web
bun test src/components/auth/credentials.test.ts src/lib/i18n/messages.test.ts
bun run typecheck
```

Beklenen: tüm yeni testler geçer; mevcut import kullanan sayfalarda tip hatası oluşmaz.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/i18n.tsx apps/web/src/lib/i18n/messages.ts apps/web/src/lib/i18n/messages.test.ts apps/web/src/components/auth/credentials.ts apps/web/src/components/auth/credentials.test.ts
git commit -m "feat(web-i18n): WES-000 auth çevirilerini ve giriş doğrulamasını ayır"
```

---

### Task 4: Dil seçiciyi ve erişilebilir login formunu oluştur

**Files:**
- Create: `apps/web/src/components/auth/language-toggle.tsx`
- Create: `apps/web/src/components/auth/login-form.tsx`

**Interfaces:**

```ts
interface LoginFormProps {
  hasProviderError: boolean;
  isPending: boolean;
  onClearProviderError: () => void;
  onSubmit: (credentials: LoginCredentials) => void;
}
```

- [ ] **Step 1: Dil seçiciyi oluştur**

`language-toggle.tsx` tek `useI18n` tüketir. İki gerçek button kullan; aktif locale `aria-pressed="true"` taşır. `role="group"` adı `t("auth.language.label")` olur. Her button tıklanınca doğrudan `setLocale("tr" | "en")` çağırır. Görünür metin yalnızca `TR` ve `EN`; aria-label sırasıyla `auth.language.switchToTurkish` ve `auth.language.switchToEnglish` anahtarından gelir.

```tsx
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="auth-language" role="group" aria-label={t("auth.language.label")}>
      {(["tr", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          aria-label={t(option === "tr" ? "auth.language.switchToTurkish" : "auth.language.switchToEnglish")}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

Map iki sabit elemanda çalışır: zaman ve alan `O(1)`.

- [ ] **Step 2: Form state'ini ve submit akışını uygula**

`login-form.tsx` yalnızca dört local state tutar: `email`, `password`, `showPassword`, `validationError`. Submit sırası:

1. `preventDefault()`.
2. `isPending` ise erken çık.
3. `validateCredentials` çağır.
4. Geçersizse `auth.error.validation` göster.
5. Geçerliyse local hatayı temizle ve `onSubmit(result.value)` çağır.

Alan değişiminde local hata temizlenir ve yalnızca provider hatası varsa `onClearProviderError()` çağrılır. Bu, her keypress'te gereksiz Refine reset yan etkisini önler.

- [ ] **Step 3: Semantik ve erişilebilir JSX'i tamamla**

Form şu sözleşmeleri eksiksiz taşımalıdır:

- `form noValidate`, görünür `Label htmlFor` bağlantıları.
- Email: `type="email"`, `inputMode="email"`, `autoComplete="email"`, `autoCapitalize="none"`.
- Şifre: `autoComplete="current-password"`.
- Şifre görünürlük button'ı `type="button"`; `Eye/EyeOff` `aria-hidden="true"`.
- İki alan da hata halinde `aria-invalid="true"` ve `aria-describedby="auth-form-error"`.
- Tek genel hata: `<p id="auth-form-error" role="alert">`; provider detayı asla render edilmez.
- Submit pending iken disabled, metin `auth.submitting`; aksi halde `auth.submit` + `ArrowUpRight`.
- Alt metin `auth.security`.

Provider ve validation hatası için tek seçim:

```ts
const errorMessage = validationError
  ? t("auth.error.validation")
  : hasProviderError
    ? t("auth.error.provider")
    : "";
```

Bu sadece iki boolean kontrolüdür, `O(1)`.

- [ ] **Step 4: Hedef dosyaları lint ve typecheck et**

```bash
cd apps/web
bunx eslint src/components/auth/language-toggle.tsx src/components/auth/login-form.tsx src/components/auth/credentials.ts
bun run typecheck
```

Beklenen: hata yok. Hook bağımlılığı veya erişilebilir button tipi uyarısı kalmamalı.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/auth/language-toggle.tsx apps/web/src/components/auth/login-form.tsx
git commit -m "feat(web-auth): WES-000 erişilebilir çok dilli giriş formunu oluştur"
```

---

### Task 5: Stilize cockpit visual ve sınırlı Motion katmanını oluştur

**Files:**
- Create: `apps/web/src/components/auth/cockpit-visual.tsx`

**Interfaces:**
- Consumes: `useHelmTheme().theme.mode`, `useI18n().t`, dört `/auth/` asset'i.
- Produces: dekoratif `<picture>` + SVG/DOM HUD; auth state'e erişmez.
- Motion contract: maksimum `±6px`, fine pointer, reduced-motion kapalı, React render loop yok.

- [ ] **Step 1: Aktif tema için tek picture ağacını kur**

Tema adına göre yalnızca bir stem üret:

```ts
const assetTheme = theme.mode === "dark" ? "dark" : "light";
const assetBase = `/auth/cockpit-${assetTheme}`;
```

Picture sözleşmesi:

```tsx
<picture key={assetTheme} className="auth-cockpit-picture">
  <source srcSet={`${assetBase}.avif`} type="image/avif" />
  <img
    src={`${assetBase}.webp`}
    alt=""
    aria-hidden="true"
    width={1800}
    height={1200}
    fetchPriority="high"
    decoding="async"
  />
</picture>
```

`key`, tema değişiminde eski ve yeni asset'in aynı anda uzun süre DOM'da tutulmasını engeller. Kesin ölçü CLS'yi sıfırlar.

- [ ] **Step 2: Parallax'ı MotionValue ile uygula**

`motion/react` içinden `m`, `useMotionValue`, `useReducedMotion`, `useSpring`, `useTransform` kullan. Pointer koordinatını element merkezine normalize et; React state yazma:

```ts
const rawX = useMotionValue(0);
const rawY = useMotionValue(0);
const x = useSpring(rawX, { stiffness: 110, damping: 24, mass: 0.35 });
const y = useSpring(rawY, { stiffness: 110, damping: 24, mass: 0.35 });
const hudX = useTransform(x, (value) => value * -0.55);
const hudY = useTransform(y, (value) => value * -0.55);
const reduceMotion = useReducedMotion();

const moveParallax = (event: React.PointerEvent<HTMLElement>) => {
  if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  rawX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 12);
  rawY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 12);
};

const resetParallax = () => {
  rawX.set(0);
  rawY.set(0);
};
```

Event başına zaman/alan `O(1)`; MotionValue doğrudan style pipeline'ını günceller, bileşen yeniden render edilmez.

- [ ] **Step 3: HUD ve giriş hareketlerini ekle**

Kök `section` `aria-labelledby="cockpit-status"` taşır. Görsel/HUD şekilleri `aria-hidden="true"`; tek anlamlı status `<p id="cockpit-status">{t("auth.visual.status")}</p>` olur.

Sabit HUD katmanı:

- Bir üst navigasyon yayı: tek SVG path, `pathLength 0→1`, 600 ms.
- İki ince köşe bracket'ı: CSS pseudo/DOM span, sürekli animasyon yok.
- Bir küçük lime status noktası: 2.8 s düşük opacity pulse.
- Bir merkezi `h` control chip: DOM metni, marka işareti; asset'e gömülmez.
- Bir horizon çizgisi: sabit cyan gradient.

Kök giriş varyantları:

```ts
const visualInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.025 };
const visualAnimate = { opacity: 1, scale: 1 };
```

Giriş 420 ms ease-out. `prefers-reduced-motion` durumunda parallax ve pulse tamamen kapanır; stroke/path doğrudan son halinde gösterilir. Büyük sürekli transform eklenmez.

- [ ] **Step 4: Hata/fallback davranışını koru**

`img` yüklenmezse picture container'ın CSS gradient background'ı ve HUD katmanı kalır; form etkilenmez. React'te image error state veya retry loop ekleme. Bu, ağ hatasını `O(1)` statik fallback ile karşılar.

- [ ] **Step 5: Hedef dosyayı doğrula**

```bash
cd apps/web
bunx eslint src/components/auth/cockpit-visual.tsx
bun run typecheck
```

Beklenen: hata yok; pointer event tipi `React.PointerEvent<HTMLElement>`, `any` yok.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auth/cockpit-visual.tsx
git commit -m "feat(web-auth): WES-000 hareketli kokpit görsel katmanını oluştur"
```

---

### Task 6: Split-login kompozisyonunu ve final CSS sistemini bağla

**Files:**
- Modify: `apps/web/src/pages/login.tsx`
- Create: `apps/web/src/styles/auth.css`
- Modify: `apps/web/src/styles/index.css`

**Interfaces:**
- `LoginPage` Refine `useLogin` sonucunu `LoginForm` props'una çevirir.
- Auth CSS yalnızca `.auth-*` namespace'inde çalışır; dashboard token'larını değiştirmez.
- Tema kaynağı `html[data-helm-theme="glass-light|glass-dark"]` olur.

- [ ] **Step 1: Eski login CSS'ini tamamen kaldır**

`apps/web/src/styles/index.css` içinden `.helm-orb-*`, `.helm-login-*`, `.helm-orbit-*`, bunların keyframe ve media query bloklarını kaldır. Uzak `images.unsplash.com` URL'si repo aramasında kalmamalı. `@custom-variant dark` ve devamındaki global tema kurallarına dokunma.

- [ ] **Step 2: LoginPage'i saf kompozisyona indir**

`login.tsx` aşağıdaki sorumlulukta kalır:

```tsx
import { useLogin } from "@refinedev/core";
import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react";

import { CockpitVisual } from "@/components/auth/cockpit-visual";
import { type LoginCredentials } from "@/components/auth/credentials";
import { LanguageToggle } from "@/components/auth/language-toggle";
import { LoginForm } from "@/components/auth/login-form";
import { useI18n } from "@/lib/i18n";
import "@/styles/auth.css";

export function LoginPage() {
  const { mutate: login, isPending, error, reset } = useLogin();
  const { t } = useI18n();
  const submit = (credentials: LoginCredentials) => {
    reset();
    login(credentials);
  };

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main className="auth-page">
          <m.section className="auth-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CockpitVisual />
            <section className="auth-panel" aria-labelledby="auth-title">
              <header className="auth-header">
                <a className="auth-brand" href="/login" aria-label={t("auth.brand.label")}>
                  <span aria-hidden="true">h</span><b>helm</b>
                </a>
                <LanguageToggle />
              </header>
              <LoginForm
                hasProviderError={Boolean(error)}
                isPending={isPending}
                onClearProviderError={reset}
                onSubmit={submit}
              />
            </section>
          </m.section>
        </main>
      </LazyMotion>
    </MotionConfig>
  );
}
```

`MotionConfig` auth subtree'sinde tutulur; `App.tsx` dokunulmaz ve Motion dashboard ana chunk'ına taşınmaz. Form başlığı `LoginForm` içindeki `id="auth-title"` ile section label'ını tamamlar.

- [ ] **Step 3: Tema token'larını yaz**

`auth.css` başında yalnızca auth'a özel semantic token'lar tanımla:

```css
.auth-page {
  --auth-bg: #e9ebf2;
  --auth-shell: #f7f5f8;
  --auth-panel: rgba(251, 249, 252, 0.92);
  --auth-text: #151822;
  --auth-muted: #6d7180;
  --auth-line: rgba(35, 42, 58, 0.12);
  --auth-field: rgba(255, 255, 255, 0.78);
  --auth-cyan: #16c9e7;
  --auth-cyan-strong: #057d9b;
  --auth-lime: #b8ef42;
  min-height: 100svh;
}

[data-helm-theme="glass-dark"] .auth-page {
  --auth-bg: #07101b;
  --auth-shell: #0b1524;
  --auth-panel: rgba(12, 22, 37, 0.94);
  --auth-text: #f4f7fb;
  --auth-muted: #9caabd;
  --auth-line: rgba(139, 218, 236, 0.16);
  --auth-field: rgba(255, 255, 255, 0.055);
  --auth-cyan: #55def5;
  --auth-cyan-strong: #8be9f8;
  --auth-lime: #c7f65a;
}
```

Koyu zemin saf siyah değildir; görsel gövdesi lacivert midtone üstünde görünür kalır.

- [ ] **Step 4: Masaüstü kompozisyonunu tek seferde final değerlerle yaz**

Temel layout değerleri:

```css
.auth-page {
  display: grid;
  place-items: center;
  overflow-x: hidden;
  padding: clamp(18px, 3vw, 44px);
  background: var(--auth-bg);
  color: var(--auth-text);
}

.auth-shell {
  display: grid;
  grid-template-columns: minmax(0, 56fr) minmax(400px, 44fr);
  width: min(94vw, 1440px);
  min-height: min(88svh, 860px);
  overflow: hidden;
  border: 1px solid var(--auth-line);
  border-radius: clamp(24px, 3vw, 38px);
  background: var(--auth-shell);
  box-shadow: 0 32px 100px rgba(16, 24, 40, 0.18);
}

.auth-cockpit { position: relative; min-width: 0; overflow: hidden; isolation: isolate; }
.auth-cockpit-picture,
.auth-cockpit-picture img { display: block; width: 100%; height: 100%; }
.auth-cockpit-picture img { object-fit: cover; object-position: 52% 50%; }
.auth-panel { display: flex; min-width: 0; flex-direction: column; padding: clamp(28px, 4vw, 64px); background: var(--auth-panel); }
.auth-header { display: flex; align-items: center; justify-content: space-between; }
.auth-form-wrap { width: min(100%, 480px); margin: auto; }
```

İki kolon arasında ayrı divider çizme. `.auth-cockpit::after` ile sağ kenarda 96 px genişliğinde `linear-gradient(90deg, transparent, var(--auth-panel))` geçiş kullan.

Tipografi ve kontrol ölçüleri:

- Marka: 16 px/650; `h` chip 34×34, radius 11 px.
- Eyebrow: 11 px uppercase, letter-spacing `.14em`, cyan.
- H1: `clamp(36px, 4vw, 58px)`, line-height `.98`, letter-spacing `-.055em`.
- Subtitle: 15 px, line-height `1.6`, maksimum 38 karakter genişlik.
- Label: 13 px/600; field yüksekliği 52 px, radius 14 px.
- İki field arası 18 px; form başlığı ile form arası 34 px.
- CTA: 52 px, radius 14 px, light temada grafit→lacivert; dark temada cyan→mavi gradient, hover `translateY(-1px)` 140 ms.
- Focus ring: `0 0 0 3px color-mix(in srgb, var(--auth-cyan) 35%, transparent)`.
- Hata rengi light `#b4233d`, dark `#ff8ca0`; her ikisinde 4.5:1 kontrol et.

- [ ] **Step 5: HUD ve responsive kurallarını yaz**

Breakpoints birebir:

```css
@media (max-width: 1023px) {
  .auth-shell { grid-template-columns: minmax(0, 1fr) minmax(360px, 1fr); }
  .auth-panel { padding-inline: clamp(28px, 4vw, 44px); }
}

@media (max-width: 767px) {
  .auth-page { display: block; padding: 0; }
  .auth-shell { display: flex; width: 100%; min-height: 100svh; flex-direction: column; border: 0; border-radius: 0; }
  .auth-cockpit { min-height: 30svh; max-height: 34svh; }
  .auth-cockpit-picture img { object-position: 50% 42%; }
  .auth-panel { min-height: 66svh; padding: 24px clamp(20px, 6vw, 36px) 36px; }
  .auth-form-wrap { margin-block: 42px auto; }
}

@media (max-width: 419px) {
  .auth-hud-secondary,
  .auth-hud-bracket { display: none; }
}

@media (max-height: 699px) and (min-width: 768px) {
  .auth-page { place-items: start center; overflow-y: auto; padding-block: 16px; }
  .auth-shell { min-height: 668px; }
}

@media (prefers-reduced-motion: reduce) {
  .auth-status-dot,
  .auth-submit { animation: none; transition-duration: 0.01ms; }
}
```

Parallax'a ait görsel katmanlarda `will-change: transform` yalnızca `@media (pointer: fine)` altında kullanılır. Mobilde GPU katmanı gereksiz yere ayrılmaz.

- [ ] **Step 6: Kaynak ve uzak asset temizliğini doğrula**

```bash
rg -n "images\.unsplash\.com|helm-orbit|helm-login-photo|helm-orb-field" apps/web/src apps/web/public
```

Beklenen: sonuç yok. `auth.css` route import'u nedeniyle login chunk'ına bağlıdır; `index.css` global şişmez.

- [ ] **Step 7: Typecheck, lint ve kritik testleri çalıştır**

```bash
cd apps/web
bunx eslint src/pages/login.tsx src/components/auth src/lib/i18n.tsx src/lib/i18n/messages.ts
bun test src/components/auth/credentials.test.ts src/lib/i18n/messages.test.ts
bun run typecheck
```

Beklenen: tüm komutlar başarılı. ESLint mevcut `react-refresh/only-export-components` uyarısını hata olarak yükseltirse `I18nProvider` ve `useI18n` ayrıştırması ayrı, davranış değiştirmeyen minimal dosya bölmesiyle yapılır; rule disable edilmez.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/login.tsx apps/web/src/styles/auth.css apps/web/src/styles/index.css
git commit -m "feat(web-auth): WES-000 roket kokpiti login kompozisyonunu tamamla"
```

---

### Task 7: Görsel, erişilebilirlik ve performans kabulünü yap

**Files:**
- Modify only if a verified defect exists: Task 2–6 target files
- Modify: `docs/superpowers/specs/2026-08-21-tron-rocket-cockpit-auth-design.md` (acceptance checklist only)

**Interfaces:**
- Kullanıcı yolculuğu: `/login` → locale seçimi → email/password → Refine `login`.
- Kabul matrisi: 2 tema × 2 locale × 3 viewport + reduced-motion ve asset failure.

- [ ] **Step 1: Production build'i çalıştır**

```bash
cd apps/web
bun run check:auth-assets
bun test src/components/auth/credentials.test.ts src/lib/i18n/messages.test.ts
bun run typecheck
bun run build
```

Beklenen: dört komut da exit code 0. Build output'ta `/login` lazy chunk'ı oluşur; Sharp client bundle'a girmez.

- [ ] **Step 2: Bundle bütçesini ölç**

Build öncesi eski commit'teki login chunk gzip değeri mevcutsa karşılaştır; yoksa mevcut route chunk'ında Motion dışındaki beklenmedik büyük bağımlılıkları Vite output'tan kontrol et. Kabul:

- Auth route JS artışı gzip en fazla 18 KiB.
- `sharp` veya `@img/sharp-*` hiçbir browser chunk'ında yok.
- `three`, `@react-three/*`, `gsap`, `lottie` bağımlılığı yok.

18 KiB aşılırsa önce Motion importlarını denetle: `motion` root import'u kullanılmamalı; yalnızca `motion/react`, `LazyMotion`, `domAnimation` ve `m` kalmalı. Davranışı CSS'e ikinci kez kopyalama.

- [ ] **Step 3: Görsel kabul matrisini çalıştır**

Local web'i aç ve aşağıdaki kombinasyonlarda ekran görüntüsü al:

| Viewport | Tema | Locale | Beklenen |
|---|---|---|---|
| 1440×900 | light | TR | 56/44 split, kokpit ve form tam görünür |
| 1440×900 | dark | EN | Gövde lacivertte kaybolmaz, metin taşmaz |
| 1024×768 | light | EN | 50/50 düzen, form en az 360 px |
| 390×844 | dark | TR | 30–34svh görsel, yatay taşma yok |

Kabul kriteri referansların birebir kopyası değil; aynı görsel hiyerarşi ve premium sakinliktir. Üç panel, büyük boş lacivert blok veya fotoğraf gerçekçiliği görülürse kabul etme.

- [ ] **Step 4: Etkileşim ve a11y kontrolü yap**

1. Tab sırası: TR → EN → email → password → show/hide → submit.
2. Visible label'lar ve focus ring her iki temada okunur.
3. Yanlış credential genel mesaj verir; hesap varlığını ifşa etmez.
4. Pending submit ikinci submit'i engeller.
5. `prefers-reduced-motion: reduce`: parallax, pulse ve stroke reveal yok.
6. Fine pointer'da köşeden köşeye parallax mutlak `6px` sınırını aşmaz.
7. DevTools ile cockpit image request'ini blokla: form ve CTA eksiksiz kalır.
8. `<html lang>` sayfa ilk açılışında ve dil değişiminde doğru değerdedir.

- [ ] **Step 5: Son kaynak kontrollerini yap**

```bash
rg -n "console\.(log|error)|images\.unsplash\.com|https://.*\.(png|jpe?g|webp|avif)|\bany\b" apps/web/src/pages/login.tsx apps/web/src/components/auth apps/web/src/styles/auth.css
git diff --check
git status --short
```

Beklenen: PII logu, uzak asset URL'si, explicit `any` ve whitespace hatası yok. `git status` yalnızca bu task'ta gerçekten yapılan kabul düzeltmelerini gösterir.

- [ ] **Step 6: Spec kabul sonuçlarını işaretle**

Design spec sonuna kısa `## Uygulama Kabulü` bölümü ekle: tarih, geçen otomatik komutlar, doğrulanan dört ekran kombinasyonu, ölçülen asset boyutları ve login chunk gzip farkı. Başarısız veya çalıştırılmamış kontrolü geçmiş gibi yazma.

- [ ] **Step 7: Son commit**

Bu task'ta doğrulanmış düzeltme veya kabul kaydı varsa ilgili dosyaları stage et:

```bash
git add docs/superpowers/specs/2026-08-21-tron-rocket-cockpit-auth-design.md apps/web/src/pages/login.tsx apps/web/src/components/auth/cockpit-visual.tsx apps/web/src/components/auth/login-form.tsx apps/web/src/components/auth/language-toggle.tsx apps/web/src/components/auth/credentials.ts apps/web/src/lib/i18n.tsx apps/web/src/lib/i18n/messages.ts apps/web/src/styles/auth.css
git commit -m "fix(web-auth): WES-000 kokpit login kabul kusurlarını gider"
```

Kod düzeltmesi yok, yalnızca kabul kaydı varsa mesajı şu yap:

```bash
git commit -m "docs(web-auth): WES-000 kokpit login kabul sonuçlarını kaydet"
```

## Final Self-Review

- **Algorithmic:** Credential validation `O(n)`; locale lookup `O(1)` average; HUD/parallax event'i ve render eleman sayısı `O(1)`. Nested loop veya input boyutuna bağlı animasyon yok.
- **Purity:** Validation ve translation saf; localStorage/document yalnızca provider effect'inde; auth ve görsel state ayrık.
- **Performance:** Tema başına tek picture, kesin ölçü, local AVIF/WebP, LazyMotion, React state'siz parallax ve sabit HUD.
- **Security:** Email/şifre loglanmaz; ham Supabase hatası maskelenir; üçüncü parti runtime request yok.
- **A11y/i18n:** Visible label, alert, focus sırası, reduced-motion, TR/EN tamlığı ve `<html lang>` doğrulanır.
- **Scope:** Global `I18nProvider` ve mevcut web sözlüğü korunur, auth kataloğu TR/EN tamamlanır. Signup/reset/OAuth/dashboard tasarımı ve tüm domain sayfalarının metin migrasyonu bu auth değişikliğine eklenmez.
