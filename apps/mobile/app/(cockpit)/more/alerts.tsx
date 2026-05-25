import { useMemo, useState } from "react";
import { View, RefreshControl, Pressable, Text, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { useAlerts, useAckAlert, type Alert, type AlertSeverity } from "~/hooks/use-alerts";
import { AlertRow } from "~/components/alert-row";
import { FilterChip } from "~/components/filter-chip";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { Icon } from "~/components/ui/icon";
import { haptic } from "~/lib/haptics";
import { toast } from "~/lib/toast";
import { colors } from "~/theme/tokens";

type Filter = "all" | AlertSeverity;

function SwipeAckAction() {
  return (
    <View
      style={{
        backgroundColor: colors.accent,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        marginVertical: 4,
        borderRadius: 14,
        flexDirection: "row",
        gap: 8,
      }}
    >
      <Icon name="circleCheck" size={18} color={colors.bgBase} />
      <Text
        style={{
          fontFamily: "GeistMono-600",
          fontSize: 10,
          color: colors.bgBase,
          letterSpacing: 1.5,
        }}
      >
        ACK
      </Text>
    </View>
  );
}

export default function Alerts() {
  const [filter, setFilter] = useState<Filter>("all");
  const alerts = useAlerts();
  const ack = useAckAlert();

  const filtered = useMemo(() => {
    const all = (alerts.data ?? []).filter((a) => !a.delivered);
    if (filter === "all") return all;
    return all.filter((a) => a.severity === filter);
  }, [alerts.data, filter]);

  const counts = useMemo(() => {
    const data = (alerts.data ?? []).filter((a) => !a.delivered);
    return {
      all: data.length,
      critical: data.filter((a) => a.severity === "critical").length,
      warn: data.filter((a) => a.severity === "warn").length,
      info: data.filter((a) => a.severity === "info").length,
    };
  }, [alerts.data]);

  function handleAck(alert: Alert) {
    haptic.success();
    ack.mutate(alert.id, {
      onSuccess: () => toast.success("Alert ack'lendi"),
      onError: () => toast.error("İşaretlenemedi"),
    });
  }

  if (alerts.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (alerts.isError) return <ScreenStatus label="Alerts yüklenemedi" tone="danger" />;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        <FilterChip
          label="Tümü"
          count={counts.all}
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterChip
          label="Kritik"
          count={counts.critical}
          active={filter === "critical"}
          onPress={() => setFilter("critical")}
        />
        <FilterChip
          label="Uyarı"
          count={counts.warn}
          active={filter === "warn"}
          onPress={() => setFilter("warn")}
        />
        <FilterChip
          label="Bilgi"
          count={counts.info}
          active={filter === "info"}
          onPress={() => setFilter("info")}
        />
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          title="Açık alert yok"
          subtitle={
            filter === "all"
              ? "Sessizlik. Her şey yolunda."
              : "Bu severity'de bir şey yok."
          }
          icon="circleCheck"
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl
              tintColor={colors.fgPrimary}
              refreshing={alerts.isRefetching}
              onRefresh={alerts.refetch}
            />
          }
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => <SwipeAckAction />}
              onSwipeableOpen={() => handleAck(item)}
              friction={2}
              rightThreshold={60}
            >
              <Pressable
                onLongPress={() => {
                  haptic.press();
                  handleAck(item);
                }}
              >
                <AlertRow alert={item} />
              </Pressable>
            </Swipeable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
