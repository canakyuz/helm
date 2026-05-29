// Compatibility shim — the panel now lives in the liquid design-system layer.
import { type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";

import { LiquidGlass, type GlassTone } from "~/components/liquid/glass";

export type { GlassTone };

type Props = {
  children: ReactNode;
  tone?: GlassTone;
  radius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function LiquidGlassPanel(props: Props) {
  return <LiquidGlass {...props} />;
}
