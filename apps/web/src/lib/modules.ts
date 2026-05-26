// helm — modül kataloğu, property type preset'leri ve provider→module mapping.
// Detay: .docs/MODULES.md

import type { ProviderName } from "@/types";
// Not: types/index.ts'ten salt-tip import (eraseable). PropertyType ve ModuleKey
// runtime sabitleri burada doğar; types/index.ts onlara inline import ile bakar.

export const MODULE_KEYS = [
  "content",
  "users",
  "analytics",
  "subscriptions",
  "ads",
  "reviews",
  "funnel",
  "push",
  "mail",
  "social",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const PROPERTY_TYPES = [
  "website",
  "web_app",
  "mobile_app",
  "desktop_app",
  "game",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

// Property type → preset modül seti (MODULES.md §4 ile birebir aynı).
// Wizard'da type seçildiğinde otomatik checked gelir.
export const PRESET_MODULES: Record<PropertyType, ModuleKey[]> = {
  website: ["content", "analytics"],
  web_app: ["users", "analytics", "subscriptions", "funnel"],
  mobile_app: ["users", "analytics", "subscriptions", "ads", "reviews", "funnel", "push"],
  desktop_app: ["users", "analytics"],
  game: ["users", "analytics", "ads", "reviews", "funnel", "push"],
};

// Type için preset değil ama UI'da checkbox olarak gösterilen opsiyoneller.
// PRESET + OPTIONAL union'ı dışında kalan modüller wizard'da görünmez.
export const OPTIONAL_MODULES: Record<PropertyType, ModuleKey[]> = {
  website: ["funnel", "mail", "social"],
  web_app: ["content", "ads", "push", "mail"],
  mobile_app: ["mail"],
  desktop_app: ["subscriptions", "mail"],
  game: ["subscriptions", "mail"],
};

// Property type için seçilebilir tüm modüller (preset ∪ optional).
export function availableModules(type: PropertyType): ModuleKey[] {
  return [...PRESET_MODULES[type], ...OPTIONAL_MODULES[type]];
}

export interface ModuleMeta {
  label: string;
  // Lucide icon adı (string olarak; render tarafı `lucide-react`'ten dinamik çözer).
  icon: string;
  description: string;
  comingSoon?: boolean;
}

export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  content: {
    label: "İçerik (CMS)",
    icon: "FileText",
    description: "Şemalar, içerikler, medya, çoklu dil.",
  },
  users: {
    label: "Müşteriler",
    icon: "Users",
    description: "Kullanıcı listesi, segmentler, kohortlar.",
  },
  analytics: {
    label: "Analitik",
    icon: "LineChart",
    description: "Trafik / DAU / retention / dönüşüm.",
  },
  subscriptions: {
    label: "Abonelik",
    icon: "CreditCard",
    description: "MRR, churn, aktif abone (RevenueCat / Stripe).",
  },
  ads: {
    label: "Reklam",
    icon: "Megaphone",
    description: "Reklam geliri, eCPM, fill rate (AdMob).",
  },
  reviews: {
    label: "Yorumlar",
    icon: "Star",
    description: "App Store / Play Store puanları ve yorumları.",
  },
  funnel: {
    label: "Huni",
    icon: "Workflow",
    description: "Adım adım dönüşüm, drop analizi (PostHog).",
  },
  push: {
    label: "Push",
    icon: "Send",
    description: "Bildirim segmentleri, kampanya gönderimi.",
  },
  mail: {
    label: "Mail",
    icon: "Mail",
    description: "Email kampanyaları, transactional (Resend).",
  },
  social: {
    label: "Sosyal",
    icon: "Share2",
    description: "Post planlama, scheduler (yakında).",
    comingSoon: true,
  },
};

// metrics.source → module mapping. DB değişikliği yerine app-side sabit.
// Yeni provider eklemek = tek satır.
export const SOURCE_TO_MODULE: Record<ProviderName, ModuleKey> = {
  revenuecat: "subscriptions",
  stripe: "subscriptions",
  admob: "ads",
  posthog: "analytics",
  plausible: "analytics",
  supabase: "users",
  app_store_connect: "reviews",
  resend: "mail",
  sentry: "analytics", // hata oranı = analytics altı
  rest: "analytics", // genel
  google_play_developer: "reviews",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  website: "Web sitesi",
  web_app: "Web uygulaması",
  mobile_app: "Mobil uygulama",
  desktop_app: "Masaüstü uygulaması",
  game: "Oyun",
};

export const PROPERTY_TYPE_DESCRIPTIONS: Record<PropertyType, string> = {
  website: "Marketing veya içerik sitesi (CMS + traffic).",
  web_app: "SaaS, dashboard, web tabanlı uygulama.",
  mobile_app: "iOS / Android native uygulama.",
  desktop_app: "macOS / Windows / Linux native uygulama.",
  game: "Mobil oyun (mobile_app'ten ayrı KPI seti).",
};
