// helm - modül kataloğu, property type preset'leri ve provider→module mapping.
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
    label: "Content (CMS)",
    icon: "FileText",
    description: "Schemas, content, media and multi-language.",
  },
  users: {
    label: "Customers",
    icon: "Users",
    description: "User list, segments and cohorts.",
  },
  analytics: {
    label: "Analitik",
    icon: "LineChart",
    description: "Traffic / DAU / retention / conversion.",
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
    description: "App Store / Play Store ratings and reviews.",
  },
  funnel: {
    label: "Huni",
    icon: "Workflow",
    description: "Step-by-step conversion and drop-off analysis (PostHog).",
  },
  push: {
    label: "Push",
    icon: "Send",
    description: "Notification segments and campaign delivery.",
  },
  mail: {
    label: "Mail",
    icon: "Mail",
    description: "Email campaigns and transactional mail (Resend).",
  },
  social: {
    label: "Sosyal",
    icon: "Share2",
    description: "Post scheduling (coming soon).",
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
  web_app: "Web app",
  mobile_app: "Mobil uygulama",
  desktop_app: "Desktop app",
  game: "Oyun",
};

export const PROPERTY_TYPE_DESCRIPTIONS: Record<PropertyType, string> = {
  website: "Marketing or content site (CMS + traffic).",
  web_app: "SaaS, dashboard or web-based app.",
  mobile_app: "iOS / Android native uygulama.",
  desktop_app: "macOS / Windows / Linux native uygulama.",
  game: "Mobile game (a KPI set separate from mobile_app).",
};
