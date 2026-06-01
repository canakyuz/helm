import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PropertyPicker } from "~/components/property-picker";
import { HeaderSyncButton } from "~/components/header-sync-button";
import { HeaderAlertsButton } from "~/components/header-alerts-button";
import { colors } from "~/theme/tokens";

type Props = {
  showAlerts?: boolean;
  showSync?: boolean;
  showPicker?: boolean;
};

export function ScreenHeader({
  showAlerts = true,
  showSync = true,
  showPicker = true,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.bgBase,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          height: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ width: 56, alignItems: "flex-start" }}>
          {showSync ? <HeaderSyncButton /> : null}
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          {showPicker ? <PropertyPicker /> : null}
        </View>
        <View style={{ width: 56, alignItems: "flex-end" }}>
          {showAlerts ? <HeaderAlertsButton /> : null}
        </View>
      </View>
    </View>
  );
}
