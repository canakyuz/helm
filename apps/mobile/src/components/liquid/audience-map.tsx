import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AppleMaps } from "expo-maps";

import { countryGeo } from "~/lib/country-geo";
import { colors, glass } from "~/theme/tokens";
import { formatInteger } from "~/lib/format";

export type AudienceMapRow = { country: string; country_name: string | null; users: number };

// Rank → marker tint: biggest market pops (lime), tail fades to muted blue.
const RANK_TINT = [colors.accent, colors.accentViolet, colors.blue, colors.blue];
const TAIL_TINT = colors.fgMuted;

export function AudienceMap({
  rows,
  height = 200,
  fill = false,
}: {
  rows: AudienceMapRow[];
  height?: number;
  fill?: boolean;
}) {
  // Resolve coords, drop unknowns, rank by users (desc) for visual hierarchy.
  const placed = useMemo(() => {
    return rows
      .map((r) => {
        const geo = countryGeo(r.country);
        return geo ? { r, geo } : null;
      })
      .filter((x): x is { r: AudienceMapRow; geo: NonNullable<ReturnType<typeof countryGeo>> } => x !== null)
      .sort((a, b) => b.r.users - a.r.users);
  }, [rows]);

  const markers = useMemo(
    () =>
      placed.map(({ r, geo }, i) => ({
        id: r.country,
        coordinates: { latitude: geo.lat, longitude: geo.lng },
        title: `${r.country.toUpperCase()} · ${formatInteger(r.users)} users`,
        tintColor: i < RANK_TINT.length ? RANK_TINT[i]! : TAIL_TINT,
        monogram: r.country.toUpperCase().slice(0, 2),
      })),
    [placed],
  );

  // Smart camera: weighted centroid of the top markers + zoom to their spread.
  const camera = useMemo(() => {
    if (placed.length === 0) {
      return { coordinates: { latitude: 20, longitude: 0 }, zoom: 0.7 };
    }
    const top = placed.slice(0, 5);
    let wlat = 0;
    let wlng = 0;
    let wsum = 0;
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    for (const { r, geo } of top) {
      const w = Math.max(1, r.users);
      wlat += geo.lat * w;
      wlng += geo.lng * w;
      wsum += w;
      minLat = Math.min(minLat, geo.lat);
      maxLat = Math.max(maxLat, geo.lat);
      minLng = Math.min(minLng, geo.lng);
      maxLng = Math.max(maxLng, geo.lng);
    }
    const span = Math.max(maxLat - minLat, (maxLng - minLng) / 1.6);
    // span (deg) → zoom: tight cluster zooms in, spread-out stays wide.
    const zoom = span > 90 ? 1.4 : span > 45 ? 2.0 : span > 15 ? 3.0 : 4.0;
    return {
      coordinates: { latitude: wlat / wsum, longitude: wlng / wsum },
      zoom,
    };
  }, [placed]);

  return (
    <View
      style={
        fill
          ? StyleSheet.absoluteFill
          : {
              height,
              marginHorizontal: 16,
              marginBottom: 12,
              borderRadius: glass.radiusSm,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }
      }
    >
      <AppleMaps.View
        style={{ flex: 1 }}
        colorScheme={AppleMaps.MapColorScheme.DARK}
        cameraPosition={camera}
        markers={markers}
        properties={{
          isMyLocationEnabled: false,
          isTrafficEnabled: false,
          mapType: AppleMaps.MapType.STANDARD,
          elevation: AppleMaps.MapStyleElevation.FLAT,
          pointsOfInterest: { including: [] },
        }}
      />
    </View>
  );
}
