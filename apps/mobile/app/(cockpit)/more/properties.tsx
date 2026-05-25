import { useMemo, useState } from "react";
import { View, RefreshControl, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";

import { useProperties, type PropertyStatus } from "~/hooks/use-properties";
import { PropertyRow } from "~/components/property-row";
import { FilterChip } from "~/components/filter-chip";
import { DetailHeader } from "~/components/detail-header";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { colors } from "~/theme/tokens";

type Filter = "all" | PropertyStatus;

export default function Properties() {
  const [filter, setFilter] = useState<Filter>("all");
  const props = useProperties();

  const filtered = useMemo(() => {
    const all = props.data ?? [];
    if (filter === "all") return all;
    return all.filter((p) => p.status === filter);
  }, [props.data, filter]);

  const counts = useMemo(() => {
    const data = props.data ?? [];
    return {
      all: data.length,
      down: data.filter((p) => p.status === "down").length,
      stale: data.filter((p) => p.status === "stale").length,
      healthy: data.filter((p) => p.status === "healthy").length,
      unknown: data.filter((p) => p.status === "unknown").length,
    };
  }, [props.data]);

  if (props.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (props.isError) return <ScreenStatus label="Properties yüklenemedi" tone="danger" />;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
        <DetailHeader
          title="Property sağlığı"
          suffix={`${counts.all} kayıt`}
          kpis={[
            {
              label: "Toplam",
              value: String(counts.all),
              accent: colors.fgPrimary,
            },
            {
              label: "Up",
              value: String(counts.healthy),
              accent: counts.healthy > 0 ? colors.accent : colors.fgMuted,
            },
            {
              label: "Bayat",
              value: String(counts.stale),
              accent: counts.stale > 0 ? colors.accentWarn : colors.fgMuted,
            },
            {
              label: "Down",
              value: String(counts.down),
              accent: counts.down > 0 ? colors.accentDanger : colors.fgMuted,
            },
          ]}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          <FilterChip label="Tümü" count={counts.all} active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label="Down" count={counts.down} active={filter === "down"} onPress={() => setFilter("down")} />
          <FilterChip label="Bayat" count={counts.stale} active={filter === "stale"} onPress={() => setFilter("stale")} />
          <FilterChip label="Up" count={counts.healthy} active={filter === "healthy"} onPress={() => setFilter("healthy")} />
          <FilterChip label="Veri yok" count={counts.unknown} active={filter === "unknown"} onPress={() => setFilter("unknown")} />
        </ScrollView>
      </View>

      {filtered.length === 0 ? (
        <EmptyState title="Property yok" subtitle={filter === "all" ? "Hub'da kayıt yok." : "Bu duruma uyan property yok."} />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl tintColor={colors.fgPrimary} refreshing={props.isRefetching} onRefresh={props.refetch} />}
          renderItem={({ item }) => <PropertyRow property={item} />}
        />
      )}
    </SafeAreaView>
  );
}
