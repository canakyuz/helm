import { useMemo, useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUsers, type HubUser } from "~/hooks/use-users";
import { DetailHeader } from "~/components/detail-header";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { SegmentedControl } from "~/components/segmented-control";
import { Icon } from "~/components/ui/icon";
import { formatRelativeTime, formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

type SortBy = "recent" | "new" | "country";

function locationLabel(u: HubUser): string {
  if (u.city && u.country) return `${u.city}, ${u.country}`;
  if (u.country) return u.country;
  if (u.location) return u.location;
  if (u.countryCode) return u.countryCode.toUpperCase();
  return "—";
}

function nameLabel(u: HubUser): string {
  if (u.username) return `@${u.username}`;
  if (u.displayName) return u.displayName;
  if (u.email) return u.email;
  return u.id.slice(0, 8);
}

function avatarInitial(u: HubUser): string {
  const src = u.username ?? u.displayName ?? u.email ?? u.id;
  return (src[0] ?? "?").toUpperCase();
}

function UserRow({ user, isLast }: { user: HubUser; isLast: boolean }) {
  const loc = locationLabel(user);
  const accent = user.premium
    ? colors.accentWarn
    : user.banned
    ? colors.accentDanger
    : colors.fgPrimary;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Avatar initial */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
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
            fontSize: 14,
            color: accent,
          }}
        >
          {avatarInitial(user)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              fontFamily: "Geist-600",
              fontSize: 14,
              color: colors.fgPrimary,
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {nameLabel(user)}
          </Text>
          {user.premium ? (
            <View
              style={{
                backgroundColor: `${colors.accentWarn}15`,
                borderWidth: 1,
                borderColor: `${colors.accentWarn}40`,
                paddingHorizontal: 5,
                paddingVertical: 0.5,
                borderRadius: 3,
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 8,
                  color: colors.accentWarn,
                  letterSpacing: 1.1,
                }}
              >
                PRO
              </Text>
            </View>
          ) : null}
          {user.banned ? (
            <View
              style={{
                backgroundColor: `${colors.accentDanger}15`,
                borderWidth: 1,
                borderColor: `${colors.accentDanger}40`,
                paddingHorizontal: 5,
                paddingVertical: 0.5,
                borderRadius: 3,
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 8,
                  color: colors.accentDanger,
                  letterSpacing: 1.1,
                }}
              >
                BAN
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {loc !== "—" ? (
            <>
              <Icon name="map" size={9} color={colors.fgMuted} />
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 10,
                  color: colors.fgMuted,
                  letterSpacing: 0.5,
                }}
                numberOfLines={1}
              >
                {loc.toUpperCase()}
              </Text>
            </>
          ) : (
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 10,
                color: colors.fgSubtle,
                letterSpacing: 0.5,
              }}
              numberOfLines={1}
            >
              KONUM YOK
            </Text>
          )}
          {user.propertyName ? (
            <>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 10,
                  color: colors.fgSubtle,
                }}
              >
                ·
              </Text>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 10,
                  color: colors.fgSubtle,
                  letterSpacing: 0.5,
                }}
                numberOfLines={1}
              >
                {user.propertyName.toUpperCase()}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 10,
            color: colors.fgSubtle,
          }}
        >
          {user.lastSignInAt
            ? formatRelativeTime(user.lastSignInAt)
            : "hiç giriş"}
        </Text>
      </View>
    </View>
  );
}

export default function Users() {
  const [sort, setSort] = useState<SortBy>("recent");
  const users = useUsers();

  const stats = useMemo(() => {
    const all = users.data ?? [];
    const cutoff24h = Date.now() - 86_400_000;
    const active24h = all.filter(
      (u) =>
        u.lastSignInAt && new Date(u.lastSignInAt).getTime() >= cutoff24h,
    ).length;
    const new7d = all.filter(
      (u) =>
        new Date(u.createdAt).getTime() >= Date.now() - 7 * 86_400_000,
    ).length;
    const withLocation = all.filter((u) => u.country || u.location).length;
    return { total: all.length, active24h, new7d, withLocation };
  }, [users.data]);

  const sorted = useMemo(() => {
    const all = [...(users.data ?? [])];
    if (sort === "new") {
      return all.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    if (sort === "country") {
      return all.sort((a, b) => {
        const ca = a.country ?? "ZZ";
        const cb = b.country ?? "ZZ";
        return ca.localeCompare(cb);
      });
    }
    // recent — last_sign_in desc
    return all.sort((a, b) => {
      const at = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
      const bt = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
      return bt - at;
    });
  }, [users.data, sort]);

  const countryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users.data ?? []) {
      const c = u.country ?? "Bilinmiyor";
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [users.data]);

  if (users.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (users.isError) {
    return <ScreenStatus label="Kullanıcılar yüklenemedi" tone="danger" />;
  }

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
            refreshing={users.isRefetching}
            onRefresh={users.refetch}
          />
        }
      >
        <DetailHeader
          title="Kullanıcılar"
          suffix={`${formatInteger(stats.total)} toplam`}
          kpis={[
            { label: "Toplam", value: formatInteger(stats.total) },
            {
              label: "24sa Aktif",
              value: formatInteger(stats.active24h),
              accent: colors.accentInfo,
            },
            {
              label: "7g Yeni",
              value: formatInteger(stats.new7d),
              accent: colors.accent,
            },
            {
              label: "Konumlu",
              value: formatInteger(stats.withLocation),
              accent: colors.accentViolet,
            },
          ]}
        />

        {/* Country breakdown */}
        {countryBreakdown.length > 0 ? (
          <>
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
                  backgroundColor: colors.accentViolet,
                  shadowColor: colors.accentViolet,
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
                TOP ÜLKE
              </Text>
              <View
                style={{ flex: 1, height: 1, backgroundColor: colors.border }}
              />
            </View>

            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              {countryBreakdown.map(([country, count], idx) => {
                const isLast = idx === countryBreakdown.length - 1;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <View
                    key={country}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: colors.bgHigher,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "GeistMono-600",
                          fontSize: 9,
                          color: colors.fgMuted,
                        }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: "Geist-600",
                        fontSize: 13,
                        color: colors.fgPrimary,
                        flex: 1,
                        letterSpacing: -0.2,
                      }}
                      numberOfLines={1}
                    >
                      {country}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "GeistMono-500",
                        fontSize: 10,
                        color: colors.fgSubtle,
                      }}
                    >
                      %{pct.toFixed(1)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "GeistMono-600",
                        fontSize: 13,
                        color: colors.fgPrimary,
                        fontVariant: ["tabular-nums"],
                        minWidth: 36,
                        textAlign: "right",
                      }}
                    >
                      {formatInteger(count)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Sort segmented */}
        <SegmentedControl
          segments={[
            { value: "recent" as const, label: "Son giriş" },
            { value: "new" as const, label: "Yeni" },
            { value: "country" as const, label: "Ülke" },
          ]}
          active={sort}
          onChange={setSort}
        />

        {/* User list */}
        {sorted.length === 0 ? (
          <View style={{ minHeight: 200 }}>
            <EmptyState
              title="Kullanıcı yok"
              subtitle="Bu property için Supabase entegrasyonu eksik olabilir."
              icon="users"
            />
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {sorted.map((u, idx) => (
              <UserRow
                key={`${u.propertyId}-${u.id}`}
                user={u}
                isLast={idx === sorted.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
