import { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  Dimensions,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RichMetricTile } from "~/components/rich-metric-tile";
import { Icon } from "~/components/ui/icon";
import { ScreenStatus } from "~/components/screen-status";
import { DetailHeader } from "~/components/detail-header";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useUsers, type HubUser } from "~/hooks/use-users";
import { haptic } from "~/lib/haptics";
import { formatInteger, formatPercent, formatRelativeTime } from "~/lib/format";
import { colors } from "~/theme/tokens";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TILE_WIDTH = SCREEN_WIDTH - 32;
const PAGE_SIZE = 10;

function nameLabel(u: HubUser): string {
  if (u.username) return `@${u.username}`;
  if (u.displayName) return u.displayName;
  if (u.email) return u.email;
  return u.id.slice(0, 8);
}

function locLabel(u: HubUser): string {
  if (u.city && u.country) return `${u.city}, ${u.country}`;
  if (u.country) return u.country;
  if (u.countryCode) return u.countryCode.toUpperCase();
  if (u.location) return u.location;
  return "—";
}

function UserMiniRow({ user, isLast }: { user: HubUser; isLast: boolean }) {
  const initial = (
    user.username ??
    user.displayName ??
    user.email ??
    user.id
  )[0]?.toUpperCase();
  const loc = locLabel(user);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        padding: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.bgHigher,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Geist-600",
            fontSize: 12,
            color: user.premium ? colors.accentWarn : colors.fgPrimary,
          }}
        >
          {initial}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: "Geist-600",
            fontSize: 13,
            color: colors.fgPrimary,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {nameLabel(user)}
        </Text>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            color: colors.fgMuted,
            letterSpacing: 0.6,
          }}
          numberOfLines={1}
        >
          {loc.toUpperCase()}
          {user.propertyName ? ` · ${user.propertyName.toUpperCase()}` : ""}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 9,
          color: colors.fgSubtle,
        }}
      >
        {user.lastSignInAt ? formatRelativeTime(user.lastSignInAt) : "—"}
      </Text>
    </View>
  );
}

export default function Growth() {
  const [page, setPage] = useState(0);

  const dau = useMetricDetail("dau");
  const kpis = useCockpitKpis();
  const users = useUsers();

  const dauDelta = kpis.data?.dauDelta ?? null;
  const dauDeltaPositive = (dauDelta ?? 0) >= 0;

  // Son giriş yapanları sırala — pagination
  const sortedUsers = useMemo(() => {
    return [...(users.data ?? [])].sort((a, b) => {
      const at = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
      const bt = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
      return bt - at;
    });
  }, [users.data]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageUsers = sortedUsers.slice(pageStart, pageStart + PAGE_SIZE);

  if (dau.isLoading) return <ScreenStatus label="Yükleniyor" />;

  return (
    <SafeAreaView
      edges={[]}
      style={{ flex: 1, backgroundColor: colors.bgBase }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.fgPrimary}
            refreshing={dau.isRefetching || users.isRefetching}
            onRefresh={() => {
              haptic.tap();
              dau.refetch();
              users.refetch();
            }}
          />
        }
      >
        {/* KPI summary */}
        <DetailHeader
          title="Büyüme özeti"
          kpis={[
            {
              label: "DAU",
              value: kpis.data ? formatInteger(kpis.data.dau) : "—",
              accent: colors.accentInfo,
            },
            {
              label: "Yeni",
              value: kpis.data ? formatInteger(kpis.data.newUsers) : "—",
              accent: colors.accent,
            },
            {
              label: "Toplam",
              value: kpis.data ? formatInteger(kpis.data.totalUsers) : "—",
              accent: colors.accentViolet,
            },
            {
              label: "Δ DAU",
              value:
                dauDelta !== null
                  ? `${dauDeltaPositive ? "▲" : "▼"} ${formatPercent(dauDelta)}`
                  : "—",
              accent:
                dauDelta === null
                  ? colors.fgMuted
                  : dauDeltaPositive
                  ? colors.accent
                  : colors.accentDanger,
            },
          ]}
          loading={kpis.isLoading}
        />

        {/* Tek hero — DAU detay */}
        <RichMetricTile
          metric="dau"
          label="Günlük Aktif"
          width={TILE_WIDTH}
          accent={colors.accentInfo}
        />

        {/* Son kullanıcılar — paginated */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 2,
            paddingTop: 4,
          }}
        >
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
              shadowOpacity: 0.7,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 10,
              letterSpacing: 2,
              color: colors.fgMuted,
            }}
          >
            SON GİRİŞ YAPANLAR
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              letterSpacing: 1.2,
              color: colors.fgSubtle,
            }}
          >
            {users.isLoading
              ? "…"
              : `${formatInteger(sortedUsers.length)} TOPLAM`}
          </Text>
        </View>

        {users.isLoading ? (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 24,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 11,
                color: colors.fgMuted,
                letterSpacing: 1.2,
              }}
            >
              YÜKLENİYOR…
            </Text>
          </View>
        ) : pageUsers.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 24,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 11,
                color: colors.fgMuted,
                letterSpacing: 1.2,
              }}
            >
              KULLANICI YOK
            </Text>
          </View>
        ) : (
          <>
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              {pageUsers.map((u, idx) => (
                <UserMiniRow
                  key={`${u.propertyId}-${u.id}`}
                  user={u}
                  isLast={idx === pageUsers.length - 1}
                />
              ))}
            </View>

            {/* Pagination */}
            {totalPages > 1 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 4,
                  paddingTop: 2,
                }}
              >
                <Pressable
                  onPress={() => {
                    if (safePage > 0) {
                      haptic.selection();
                      setPage(safePage - 1);
                    }
                  }}
                  disabled={safePage === 0}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: pressed
                      ? colors.bgHigher
                      : colors.bgElevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: safePage === 0 ? 0.4 : 1,
                  })}
                >
                  <View style={{ transform: [{ rotate: "180deg" }] }}>
                    <Icon
                      name="chevronRight"
                      size={12}
                      color={colors.fgPrimary}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: "GeistMono-600",
                      fontSize: 10,
                      letterSpacing: 1.2,
                      color: colors.fgPrimary,
                    }}
                  >
                    ÖNCE
                  </Text>
                </Pressable>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "GeistMono-600",
                      fontSize: 16,
                      color: colors.fgPrimary,
                      fontVariant: ["tabular-nums"],
                      letterSpacing: -0.3,
                    }}
                  >
                    {safePage + 1}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: 10,
                      color: colors.fgSubtle,
                      letterSpacing: 1.2,
                    }}
                  >
                    / {totalPages}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    if (safePage < totalPages - 1) {
                      haptic.selection();
                      setPage(safePage + 1);
                    }
                  }}
                  disabled={safePage >= totalPages - 1}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: pressed
                      ? colors.bgHigher
                      : colors.bgElevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: safePage >= totalPages - 1 ? 0.4 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: "GeistMono-600",
                      fontSize: 10,
                      letterSpacing: 1.2,
                      color: colors.fgPrimary,
                    }}
                  >
                    SONRA
                  </Text>
                  <Icon
                    name="chevronRight"
                    size={12}
                    color={colors.fgPrimary}
                  />
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
