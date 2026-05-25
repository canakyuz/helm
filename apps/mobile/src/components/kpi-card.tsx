import { View, Text } from "react-native";

import { formatPercent } from "~/lib/format";

type Props = {
  label: string;
  value: string;
  delta?: number | null;
  tone?: "default" | "danger" | "warn";
};

const toneClass = {
  default: "border-border",
  danger: "border-accent-danger",
  warn: "border-accent-warn",
} as const;

export function KpiCard({ label, value, delta, tone = "default" }: Props) {
  return (
    <View className={`flex-1 bg-bg-surface border rounded-xl p-4 gap-2 ${toneClass[tone]}`}>
      <Text className="text-fg-muted text-xs uppercase tracking-wider">{label}</Text>
      <Text className="text-fg-primary text-2xl font-semibold">{value}</Text>
      {delta !== undefined && delta !== null && (
        <Text className={delta >= 0 ? "text-accent text-xs" : "text-accent-danger text-xs"}>
          {formatPercent(delta)}
        </Text>
      )}
    </View>
  );
}
