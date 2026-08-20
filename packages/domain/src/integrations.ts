// Entegrasyon saglayicilari - TEK DOGRULUK KAYNAGI.
//
// NEDEN BURADA: bu bilgi uc yerde ayri ayri yasiyordu ve UCU DE FARKLIYDI:
//   DB check (0029_google_play_developer_provider.sql)  11 saglayici
//   PROVIDER_LABEL (packages/api/src/system-health.ts)   9  - resend + google_play eksik
//   ProviderName tipi (ayni dosya)                       8  - "appstoreconnect" YANLIS
//                                                            YAZIM; DB'de "app_store_connect"
//
// Sonucu urunde goruluyordu: etiketi olmayan saglayici ekranda ham DB kimligi
// olarak cikiyordu (`google_play_developer`) - PROVIDER_LABEL tam da bunu
// onlemek icin yazilmisti.
//
// LISTE DB CHECK CONSTRAINT'I ILE BIREBIR OLMALI. Yeni saglayici once migration
// ile eklenir, sonra buraya. Buradaki sira arayuzdeki secici sirasini belirler.

export const PROVIDERS = [
  "revenuecat",
  "admob",
  "posthog",
  "supabase",
  "stripe",
  "plausible",
  "rest",
  "sentry",
  "app_store_connect",
  "resend",
  "google_play_developer",
] as const;

export type ProviderName = (typeof PROVIDERS)[number];

/** Saglayici kimligi → insan okunur ad. Ham DB kimligi ekrana cikmamali. */
export const PROVIDER_LABEL: Record<ProviderName, string> = {
  revenuecat: "RevenueCat",
  admob: "AdMob",
  posthog: "PostHog",
  supabase: "Supabase",
  stripe: "Stripe",
  plausible: "Plausible",
  rest: "REST",
  sentry: "Sentry",
  app_store_connect: "App Store Connect",
  resend: "Resend",
  google_play_developer: "Google Play Developer",
};

/** Bir saglayicinin "bagla" formundaki tek alani. */
export type FieldDef = {
  key: string;
  label: string;
  /** true ise deger EKRANA HIC GETIRILMEZ; yalnizca yazilir (bkz. mobil sources). */
  secret?: boolean;
  placeholder?: string;
  optional?: boolean;
  multiline?: boolean;
};

/** Her saglayicinin "bagla" formunda istedigi alanlar. */
export const PROVIDER_FIELDS: Record<ProviderName, FieldDef[]> = {
  revenuecat: [
    {
      key: "rc_project_id",
      label: "RevenueCat Project ID",
      placeholder: "projXXXXXXXX",
    },
    { key: "api_key", label: "v2 Secret API Key", secret: true },
    {
      key: "currency",
      label: "Para birimi (ISO kodu - RC raporlama, genelde USD)",
      placeholder: "USD",
      optional: true,
    },
    {
      key: "mrr_cents",
      label: "Fiyat ondalığı (hep .99 ise - MRR kuruşunu RC yuvarlamasına rağmen ekler)",
      placeholder: "0.99",
      optional: true,
    },
  ],
  admob: [
    {
      key: "publisher_id",
      label: "Publisher ID",
      placeholder: "pub-XXXXXXXXXXXXXXXX",
    },
    { key: "client_id", label: "OAuth Client ID" },
    { key: "client_secret", label: "OAuth Client Secret", secret: true },
    { key: "refresh_token", label: "Refresh Token", secret: true },
    {
      key: "currency",
      label: "Para birimi (ISO kodu - TRY/USD/EUR)",
      placeholder: "USD",
      optional: true,
    },
  ],
  posthog: [
    { key: "project_id", label: "PostHog Project ID", placeholder: "12345" },
    { key: "api_key", label: "Personal API Key", secret: true },
    { key: "host", label: "Host", placeholder: "https://eu.posthog.com" },
    {
      key: "funnel_steps",
      label: "Huni adımları (virgülle ayır, event adları)",
      placeholder: "app_opened, signup, onboarding_complete, purchase",
      optional: true,
    },
  ],
  supabase: [
    {
      key: "project_url",
      label: "Project URL",
      placeholder: "https://xxxx.supabase.co",
    },
    { key: "service_role_key", label: "Service Role Key", secret: true },
    {
      key: "crm_tables",
      label: "CRM tabloları (virgülle ayır, opsiyonel `tablo:kolon`)",
      placeholder: "profiles:id, gems, subscriptions",
      optional: true,
    },
    {
      key: "push_token_table",
      label: "Push token tablosu (Expo)",
      placeholder: "profiles",
      optional: true,
    },
    {
      key: "push_token_column",
      label: "Push token kolonu",
      placeholder: "expo_push_token",
      optional: true,
    },
    {
      key: "push_user_column",
      label: "Push tablosunda user UUID kolonu",
      placeholder: "id",
      optional: true,
    },
  ],
  stripe: [{ key: "secret_key", label: "Stripe Secret Key", secret: true }],
  plausible: [
    { key: "site_id", label: "Site ID (alan adı)", placeholder: "ornek.com" },
    { key: "api_key", label: "API Key", secret: true },
    { key: "host", label: "Host", placeholder: "https://plausible.io" },
  ],
  rest: [
    {
      key: "url",
      label: "Endpoint URL",
      placeholder: "https://api.uygulamam.com/helm-metrics",
    },
    {
      key: "auth_header",
      label: "Authorization header (opsiyonel)",
      secret: true,
      optional: true,
    },
  ],
  sentry: [
    { key: "org_slug", label: "Sentry organizasyon slug" },
    { key: "project_slug", label: "Proje slug" },
    { key: "auth_token", label: "Auth Token", secret: true },
    {
      key: "host",
      label: "Host (self-hosted için)",
      placeholder: "https://sentry.io",
      optional: true,
    },
  ],
  resend: [
    {
      key: "api_key",
      label: "Resend API Key",
      placeholder: "re_xxxxxxxxxxxxxxxxxxxxxxxx",
      secret: true,
    },
    {
      key: "from_email",
      label: "Gönderen e-posta (Resend'de doğrulanmış domain)",
      placeholder: "no-reply@helm.app",
    },
    {
      key: "from_name",
      label: "Gönderen adı",
      placeholder: "Helm",
      optional: true,
    },
  ],
  app_store_connect: [
    {
      key: "app_store_id",
      label: "App Store ID (App Store URL'inde id sonrası rakam - yorumlar için)",
      placeholder: "6451234567",
      optional: true,
    },
    {
      key: "app_store_country",
      label: "App Store ülke kodları (virgülle ayır - yorumlar için)",
      placeholder: "tr,us,gb,de",
      optional: true,
    },
    {
      key: "issuer_id",
      label: "Issuer ID (Team Key için - Individual API Key'de BOŞ bırak)",
      placeholder: "57246542-96fe-1a63-e053-0824d011072a",
      optional: true,
    },
    {
      key: "key_id",
      label: "Key ID",
      placeholder: "2X9R4HXF34",
    },
    {
      key: "private_key",
      label: "Private Key (.p8 içeriği - BEGIN/END dahil)",
      secret: true,
      multiline: true,
      placeholder: "-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----",
    },
    {
      key: "vendor_number",
      label: "Vendor Number (Payments and Financial Reports)",
      placeholder: "85123456",
    },
    {
      key: "currency",
      label: "Proceeds para birimi (ISO kodu)",
      placeholder: "USD",
      optional: true,
    },
  ],
  google_play_developer: [
    {
      key: "service_account_json",
      label: "Service Account JSON (Google Cloud → IAM → Service Accounts → Keys → CREATE → JSON; içeriğin TAMAMINI yapıştır)",
      placeholder: '{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key_id": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "helm@your-project.iam.gserviceaccount.com",\n  ...\n}',
      secret: true,
      multiline: true,
    },
    {
      key: "package_name",
      label: "Package Name (opsiyonel - boşsa properties.google_play_id'den okunur)",
      placeholder: "com.example.app",
      optional: true,
    },
    {
      key: "language_codes",
      label: "Yorum çeviri dilleri (virgülle, opsiyonel - reviews için, versions etkilenmez)",
      placeholder: "en,tr",
      optional: true,
    },
  ],
};

/** Bir alan sir mi? Mobil bu bilgiyi degeri EKRANA GETIRMEMEK icin kullanir. */

export function isSecretKey(provider: ProviderName, key: string): boolean {
  return PROVIDER_FIELDS[provider].some((f) => f.key === key && f.secret === true);
}

/**
 * Saglayici etiketi - bilinmeyen kimlik ham deger olarak doner.
 *
 * NEDEN AYRI FONKSIYON: PROVIDER_LABEL artik `Record<ProviderName, string>`,
 * yani eksik saglayici DERLEME HATASI veriyor (kopyalarin ayrismasinin sebebi
 * gevsek `Record<string, string>` idi). Ama cagri yerlerinde `provider` alani
 * DB'den `string` geliyor; indekslemek tip hatasi verir. Arama tek yerde,
 * dusme davranisi da tek yerde.
 */
export function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider as ProviderName] ?? provider;
}
