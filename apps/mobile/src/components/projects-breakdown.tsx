import { View, Text, Pressable } from "react-native";

import { useProjectsBreakdown } from "~/hooks/use-projects-breakdown";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { formatInteger } from "~/lib/format";
import { preferences } from "~/lib/preferences";
import { Glass } from "~/components/ui/glass";
import { Icon, type IconName } from "~/components/ui/icon";
import { haptic } from "~/lib/haptics";
import type { PropertyType } from "~/hooks/use-properties";

const TYPE_ICON: Record<PropertyType, IconName> = {
  website: "layers",
  web_app: "layers",
  mobile_app: "activity",
  desktop_app: "layers",
  game: "activity",
};

export function ProjectsBreakdown() {
  const fmt = useFormatCurrency();
  const { data, isLoading } = useProjectsBreakdown();

  if (isLoading || !data || data.length === 0) return null;

  // En çok MRR'lı projeler önde — kullanıcı önemliyi hızlı görsün.
  const sorted = [...data].sort((a, b) => b.mrr - a.mrr);

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-fg-muted text-xs uppercase tracking-wider">
          Projelere göre
        </Text>
        <Text className="text-fg-subtle text-xs">{data.length}</Text>
      </View>

      <Glass>
        <View>
          {sorted.map((p, idx) => (
            <Pressable
              key={p.id}
              onPress={() => {
                haptic.selection();
                preferences.setSelectedProperty(p.id);
              }}
              className={
                idx === sorted.length - 1
                  ? "flex-row items-center gap-3 p-3 active:opacity-80"
                  : "flex-row items-center gap-3 p-3 border-b border-border/40 active:opacity-80"
              }
            >
              <View className="w-8 h-8 rounded-lg bg-bg-elevated items-center justify-center">
                <Icon name={TYPE_ICON[p.type]} size={14} color="#a1a1aa" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-fg-primary text-sm font-medium" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="text-fg-subtle text-xs" numberOfLines={1}>
                  {p.brandName ?? "—"}
                  {p.dau > 0 ? ` · DAU ${formatInteger(p.dau)}` : ""}
                </Text>
              </View>
              <View className="items-end gap-0.5">
                <Text className="text-fg-primary text-sm font-medium">{fmt(p.mrr)}</Text>
                {p.openAlerts > 0 ? (
                  <View className="flex-row items-center gap-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-accent-danger" />
                    <Text className="text-accent-danger text-[10px]">{p.openAlerts}</Text>
                  </View>
                ) : (
                  <Icon name="chevronRight" size={12} color="#71717a" />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </Glass>
    </View>
  );
}
