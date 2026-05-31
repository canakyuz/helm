import { useMemo } from "react";
import { View } from "react-native";
import { AppleMaps } from "expo-maps";

import { countryGeo } from "~/lib/country-geo";
import { colors, glass } from "~/theme/tokens";
import { formatInteger } from "~/lib/format";

export type AudienceMapRow = { country: string; country_name: string | null; users: number };

export function AudienceMap({ rows, height = 200 }: { rows: AudienceMapRow[]; height?: number }) {
  const markers = useMemo(() => {
    return rows
      .map((r) => {
        const geo = countryGeo(r.country);
        if (!geo) return null;
        return {
          id: r.country,
          coordinates: { latitude: geo.lat, longitude: geo.lng },
          title: `${r.country_name ?? geo.name} · ${formatInteger(r.users)}`,
          tintColor: colors.accent,
          monogram: r.country.toUpperCase().slice(0, 2),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [rows]);

  return (
    <View
      style={{
        height,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: glass.radiusSm,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <AppleMaps.View
        style={{ flex: 1 }}
        colorScheme={AppleMaps.MapColorScheme.DARK}
        cameraPosition={{ coordinates: { latitude: 20, longitude: 0 }, zoom: 0.7 }}
        markers={markers}
        properties={{ isMyLocationEnabled: false, isTrafficEnabled: false }}
      />
    </View>
  );
}
