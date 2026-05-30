// Mock-only prototype concepts NOT present in the real Supabase layer.
// Every value here is DEMO — consumers MUST render a `DEMO` chip next to it.
// See docs/superpowers/specs/2026-05-30-helm-liquid-glass-foundation-overview-design.md

import { colors } from "~/theme/tokens";

export const DEMO_TAG = "DEMO" as const;

function series(n: number, base: number, vol: number, trend: number): number[] {
  // deterministic-ish wave (no Math.random — stable across renders)
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += Math.sin(i * 0.7) * vol * 0.4 + (((i * 53) % 11) / 11 - 0.45) * vol + trend;
    out.push(Math.max(0, Math.round(v)));
  }
  return out;
}

export const demoData = {
  // ── Overview ──
  projectDetail: { revToday: 1680, mrr: 14_100, crashFree: 99.5 },

  // ── Revenue ──
  revTrend: series(30, 380, 60, 14),
  arpu: 0.42,
  conversion: 7.2,
  refundRate: 1.4,
  revenueSplit: [
    { label: "Subscriptions", value: 61_800, pct: 49, color: colors.accentViolet },
    { label: "In-app purchase", value: 38_400, pct: 31, color: colors.accent },
    { label: "Ad revenue", value: 24_900, pct: 20, color: colors.blue },
  ],
  revTotal: 125_100,
  platformSplit: [
    { label: "iOS", value: 72_558, pct: 58, color: colors.accent },
    { label: "Android", value: 33_777, pct: 27, color: colors.accentViolet },
    { label: "Web", value: 18_765, pct: 15, color: colors.blue },
  ],
  mrrMovement: [
    { label: "New", value: 4200, color: colors.green, sign: 1 },
    { label: "Expansion", value: 2100, color: colors.accent, sign: 1 },
    { label: "Contraction", value: -900, color: colors.accentWarn, sign: -1 },
    { label: "Churn", value: -2800, color: colors.accentDanger, sign: -1 },
  ],
  mrrNet: 2600,
  subs: { active: 3840, trial: 412, trialConv: 38, churnRate: 3.1, trend: series(30, 52_000, 1400, 320) },
  payouts: {
    stripePending: 8420,
    appStorePending: 12_180,
    nextDate: "Jun 1",
    recent: [
      { source: "Stripe", amount: 7980, date: "May 24", status: "paid" },
      { source: "App Store", amount: 11_240, date: "May 15", status: "paid" },
      { source: "Stripe", amount: 7610, date: "May 17", status: "paid" },
      { source: "Google Play", amount: 5320, date: "May 15", status: "paid" },
    ],
  },
  transactions: [
    { id: "t1", type: "Subscription", detail: "Pro · annual", project: "Lumen", amount: 71.88, kind: "sub", ago: "2dk önce" },
    { id: "t2", type: "IAP", detail: "500 gems", project: "Voxel Raiders", amount: 4.99, kind: "iap", ago: "6dk önce" },
    { id: "t3", type: "Subscription", detail: "Plus · monthly", project: "DriftPay", amount: 9.99, kind: "sub", ago: "11dk önce" },
    { id: "t4", type: "IAP", detail: "Remove ads", project: "Orbit Golf", amount: 2.99, kind: "iap", ago: "14dk önce" },
    { id: "t5", type: "Subscription", detail: "Team · annual", project: "nimbus.app", amount: 240.0, kind: "sub", ago: "19dk önce" },
    { id: "t6", type: "Refund", detail: "Pro · monthly", project: "Lumen", amount: -11.99, kind: "refund", ago: "33dk önce" },
  ],

  // ── Analytics ──
  funnel: [
    { label: "Install", value: 100_000 },
    { label: "Open", value: 78_400 },
    { label: "Sign up", value: 41_200 },
    { label: "Activate", value: 26_800 },
    { label: "Pay", value: 7240 },
  ],
  acquisition: [
    { label: "Organic search", users: 32_200, pct: 46, color: colors.accent },
    { label: "Paid · UA", users: 21_700, pct: 31, color: colors.accentViolet },
    { label: "Referral", users: 9800, pct: 14, color: colors.blue },
    { label: "Social", users: 6300, pct: 9, color: colors.green },
  ],
  countries: [
    { code: "US", name: "United States", pct: 34, dau: 24_500 },
    { code: "TR", name: "Türkiye", pct: 19, dau: 13_600 },
    { code: "DE", name: "Germany", pct: 12, dau: 8600 },
    { code: "GB", name: "United Kingdom", pct: 9, dau: 6400 },
    { code: "BR", name: "Brazil", pct: 8, dau: 5700 },
    { code: "JP", name: "Japan", pct: 6, dau: 4300 },
  ],
} as const;

export type DemoData = typeof demoData;
