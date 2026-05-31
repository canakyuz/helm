import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { AppleMaps } from "expo-maps";

import { countryGeo, countryFlag } from "~/lib/country-geo";
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
  const [selected, setSelected] = useState<string | null>(null);

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

  // Default the info pill to the top market until the user taps a marker.
  useEffect(() => {
    if (selected == null && placed.length > 0) setSelected(placed[0]!.r.country);
  }, [placed, selected]);

  const markers = useMemo(
    () =>
      placed.map(({ r, geo }, i) => ({
        id: r.country,
        coordinates: { latitude: geo.lat, longitude: geo.lng },
        title: `${countryFlag(r.country)} ${r.country_name ?? geo.name} · ${formatInteger(r.users)} users`,
        tintColor: i < RANK_TINT.length ? RANK_TINT[i]! : TAIL_TINT,
        monogram: countryFlag(r.country),
      })),
    [placed],
  );

  const active = useMemo(
    () => placed.find((p) => p.r.country === selected) ?? placed[0] ?? null,
    [placed, selected],
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
    const zoom = span > 90 ? 1.4 : span > 45 ? 2.0 : span > 15 ? 3.0 : 4.0;
    return { coordinates: { latitude: wlat / wsum, longitude: wlng / wsum }, zoom };
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
        onMarkerClick={(m) => {
          if (m?.id) setSelected(m.id);
        }}
        properties={{
          isMyLocationEnabled: false,
          isTrafficEnabled: false,
          mapType: AppleMaps.MapType.STANDARD,
          elevation: AppleMaps.MapStyleElevation.FLAT,
          pointsOfInterest: { including: [] },
        }}
      />

      {/* selected-country info pill — animates in/out + cross-fades on change */}
      {active ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 16, top: 16 }}>
          <Animated.View
            key={active.r.country}
            entering={FadeIn.duration(260)}
            exiting={FadeOut.duration(180)}
            layout={LinearTransition.springify().damping(18)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 7,
              paddingHorizontal: 11,
              borderRadius: 999,
              backgroundColor: "rgba(10,10,14,0.7)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ fontSize: 15 }}>{countryFlag(active.r.country)}</Text>
            <Text style={{ fontFamily: "Geist-600", fontSize: 13, color: colors.fgPrimary, letterSpacing: -0.2 }}>
              {active.r.country_name ?? active.geo.name}
            </Text>
            <Text style={{ fontFamily: "GeistMono-600", fontSize: 12, color: colors.accent }}>
              {formatInteger(active.r.users)}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
