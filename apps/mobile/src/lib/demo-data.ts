// Mock-only prototype concepts NOT present in the real Supabase layer.
// Every value here is DEMO — consumers MUST render a `DEMO` chip next to it.
// See docs/superpowers/specs/2026-05-30-helm-liquid-glass-foundation-overview-design.md

export const DEMO_TAG = "DEMO" as const;

export const demoData = {
  // Overview monthly revenue goal strip
  goal: { target: 150_000, current: 118_200, label: "May target" },
  // crash-free %, only used when useSystemHealth does not expose it
  crashFree: 99.2,
  crashFreeDelta: -1.8,
  // per-project KV detail values shown when expanding an Overview project row
  // keyed by intent, not by project — purely illustrative
  projectDetail: {
    revToday: 1680,
    mrr: 14_100,
    crashFree: 99.5,
  },
} as const;

export type DemoData = typeof demoData;
