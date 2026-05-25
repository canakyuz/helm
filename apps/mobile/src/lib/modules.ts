import type { IconName } from "~/components/ui/icon";
import type { CockpitKpis } from "~/hooks/use-cockpit-kpis";

export type ModuleId =
  | "subscriptions"
  | "users"
  | "ads"
  | "reviews"
  | "funnel"
  | "push"
  | "analytics"
  | "content";

export type TileDef = {
  key: string;
  module: ModuleId | "core";
  icon: IconName;
  label: string;
  // formatCurrency parametresine düşmesi gereken değerler için flag.
  isCurrency?: boolean;
  pick: (k: CockpitKpis) => number;
};

// Modüllere göre tile registry. "core" tiles her zaman görünür (modülden bağımsız).
export const TILE_REGISTRY: TileDef[] = [
  // CORE — modülden bağımsız her zaman göster.
  {
    key: "open-alerts",
    module: "core",
    icon: "bell",
    label: "Açık alert",
    pick: (k) => k.openAlerts,
  },
  {
    key: "critical-alerts",
    module: "core",
    icon: "circleAlert",
    label: "Kritik",
    pick: (k) => k.criticalAlerts,
  },
  // SUBSCRIPTIONS — MRR rich-tile'da, basit grid'de sadece aktif abone.
  {
    key: "active-subs",
    module: "subscriptions",
    icon: "users",
    label: "Aktif abone",
    pick: (k) => k.activeSubs,
  },
  // USERS
  {
    key: "dau",
    module: "users",
    icon: "users",
    label: "DAU",
    pick: (k) => k.dau,
  },
  {
    key: "total-users",
    module: "users",
    icon: "users",
    label: "Toplam kullanıcı",
    pick: (k) => k.totalUsers,
  },
  {
    key: "new-users",
    module: "users",
    icon: "trendUp",
    label: "Yeni kullanıcı",
    pick: (k) => k.newUsers,
  },
  // ADS — ad_revenue rich-tile'da gösteriliyor, basit grid'e koymuyoruz.
];

export function tilesForModules(modules: ModuleId[] | "all"): TileDef[] {
  if (modules === "all") return TILE_REGISTRY;
  const set = new Set<ModuleId>(modules);
  return TILE_REGISTRY.filter(
    (tile) => tile.module === "core" || set.has(tile.module as ModuleId),
  );
}
