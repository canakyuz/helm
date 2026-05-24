// Provider taxonomy — Entegrasyonlar sayfasında kategori grupları + ikon + açıklama.

import type { ProviderName } from "@/types";

export type ProviderCategory =
  | "analytics"
  | "revenue"
  | "users"
  | "monitoring"
  | "communication"
  | "custom";

export interface ProviderMeta {
  category: ProviderCategory;
  /** Lucide icon adı (string). UI tarafı dinamik resolve eder. */
  icon: string;
  description: string;
  docs?: string;
}

export const PROVIDER_META: Record<ProviderName, ProviderMeta> = {
  posthog: {
    category: "analytics",
    icon: "BarChart3",
    description: "Olay analitiği · funnel · kohort · geo",
    docs: "https://posthog.com/docs",
  },
  plausible: {
    category: "analytics",
    icon: "TrendingUp",
    description: "Sade web analytics · cookie-free",
    docs: "https://plausible.io/docs",
  },
  revenuecat: {
    category: "revenue",
    icon: "CreditCard",
    description: "iOS+Android abonelik · MRR · churn",
    docs: "https://www.revenuecat.com/docs",
  },
  stripe: {
    category: "revenue",
    icon: "DollarSign",
    description: "Web ödeme · abonelik · payouts",
    docs: "https://stripe.com/docs/api",
  },
  admob: {
    category: "revenue",
    icon: "Megaphone",
    description: "Mobil reklam geliri · eCPM · gösterim",
    docs: "https://developers.google.com/admob",
  },
  app_store_connect: {
    category: "revenue",
    icon: "Apple",
    description: "App Store satış · indirme · yorum",
    docs: "https://developer.apple.com/app-store-connect/api/",
  },
  supabase: {
    category: "users",
    icon: "Database",
    description: "Auth kullanıcıları · CRM tablo · push token",
    docs: "https://supabase.com/docs",
  },
  sentry: {
    category: "monitoring",
    icon: "AlertOctagon",
    description: "Hata izleme · stack trace · top issues",
    docs: "https://docs.sentry.io",
  },
  resend: {
    category: "communication",
    icon: "Mail",
    description: "Transactional + kampanya mail · webhooks",
    docs: "https://resend.com/docs",
  },
  rest: {
    category: "custom",
    icon: "Webhook",
    description: "Özel REST endpoint · jsonb config",
  },
};

export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  analytics: "Analitik",
  revenue: "Gelir",
  users: "Kullanıcı / Auth",
  monitoring: "Sağlık & İzleme",
  communication: "İletişim",
  custom: "Özel",
};

export const CATEGORY_ORDER: ProviderCategory[] = [
  "users",
  "revenue",
  "analytics",
  "monitoring",
  "communication",
  "custom",
];
