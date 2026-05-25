import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  children: ReactNode;
  intensity?: number;
  tone?: "default" | "danger" | "warn" | "info";
  className?: string;
  style?: ViewStyle;
};

const toneBorder = {
  default: "border-border",
  danger: "border-accent-danger/40",
  warn: "border-accent-warn/40",
  info: "border-accent-info/40",
} as const;

export function Glass({
  children,
  intensity = 30,
  tone = "default",
  className = "",
  style,
}: Props) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border ${toneBorder[tone]} ${className}`}
      style={style}
    >
      <BlurView intensity={intensity} tint="dark" style={{ flex: 1 }}>
        <View className="bg-bg-surface/40">{children}</View>
      </BlurView>
    </View>
  );
}
