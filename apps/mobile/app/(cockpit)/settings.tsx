import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useProperties } from "~/hooks/use-properties";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useAlertRulesCount } from "~/hooks/use-property-metrics";
import { useRevenueGoal, useSetRevenueGoal } from "~/hooks/use-revenue-goal";
import { formatRelativeTime } from "~/lib/format";
import {
  normalizeRevenueMultiplier,
  usePreferences,
  preferences,
  type Currency,
} from "~/lib/preferences";
import { supabase } from "~/lib/supabase";
import { haptic } from "~/lib/haptics";
import { colors, type } from "~/theme/tokens";
import {
  LiquidBackground,
  LiquidHeader,
  LiquidGlass,
  CornerTicks,
  Eyebrow,
  Seg,
  Toggle,
  StatusDot,
} from "~/components/liquid";

// ─── local SetRow helper ──────────────────────────────────────────────────────

type SetRowProps = {
  label: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  right?: React.ReactNode;
  danger?: boolean;
  onPress?: () => void;
  isLast?: boolean;
};

function SetRow({ label, sub, value, valueColor, right, danger, onPress, isLast }: SetRowProps) {
  const hasRight = right != null;
  const hasValue = value != null && !hasRight;

  return (
    <Pressable
      onPress={onPress}
      disabled={onPress == null}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "rgba(255,255,255,0.055)",
      }}
    >
      {/* label + optional sub */}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: "Geist-500",
            fontSize: type.body,
            color: danger === true ? colors.accentDanger : colors.fgPrimary,
            letterSpacing: -0.1,
          }}
        >
          {label}
        </Text>
        {sub != null ? (
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: type.label,
              color: colors.fgSubtle,
              letterSpacing: 0.3,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>

      {/* right slot: explicit node > value+chevron */}
      {hasRight ? (
        <View style={{ flexShrink: 0 }}>{right}</View>
      ) : hasValue ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: type.bodySm,
              color: valueColor ?? colors.fgSecondary,
              letterSpacing: 0.2,
            }}
          >
            {value}
          </Text>
          {onPress != null ? (
            <Text style={{ color: colors.fgSubtle, fontSize: 13 }}>›</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Settings() {
  const { currency, revenueMultiplier, prioritizeRevenueRequests } = usePreferences();
  const propertiesQuery = useProperties();
  const healthQuery = useSystemHealth();
  const alertRules = useAlertRulesCount();
  const goal = useRevenueGoal();
  const setGoal = useSetRevenueGoal();

  function promptGoal() {
    haptic.tap();
    Alert.prompt(
      "Monthly revenue target",
      "Hedef tutarı gir (sayı). İlerleme ad revenue ay toplamından hesaplanır.",
      (text) => {
        const n = Number((text ?? "").replace(/[^\d.]/g, ""));
        if (!Number.isFinite(n) || n < 0) return;
        setGoal.mutate({ target: n, currency });
      },
      "plain-text",
      goal.data?.target_amount != null ? String(goal.data.target_amount) : "",
      "numeric",
    );
  }

  function promptRevenueMultiplier() {
    haptic.tap();
    Alert.prompt(
      "Revenue multiplier",
      "Enter a value from 1 to 100. This only changes local display values.",
      (text) => {
        const n = Number((text ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
        if (!Number.isFinite(n)) return;
        preferences.setRevenueMultiplier(normalizeRevenueMultiplier(n));
      },
      "plain-text",
      String(revenueMultiplier),
      "decimal-pad",
    );
  }
  const lastSyncAt = healthQuery.data?.lastSyncRun?.finishedAt ?? null;

  // local toggle state
  const [pushEnabled, setPushEnabled] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(false);

  const projectCount = propertiesQuery.data?.length ?? 0;
  const integrations = healthQuery.data?.integrations ?? [];
  const okCount = healthQuery.data?.okCount ?? 0;
  const totalIntegrations = healthQuery.data?.totalIntegrations ?? 0;

  function integStatusColor(status: "ok" | "error" | "pending"): string {
    if (status === "ok") return colors.green;
    if (status === "error") return colors.accentDanger;
    return colors.accentWarn;
  }

  function integStatusLabel(status: "ok" | "error" | "pending"): string {
    if (status === "ok") return "Connected";
    if (status === "error") return "Degraded";
    return "Pending";
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader showPicker={false} />
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. ACCOUNT CARD ─────────────────────────────────────────── */}
          <LiquidGlass glow={colors.accent} deco={<CornerTicks />} padding={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              {/* avatar */}
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 22,
                    color: colors.accentInk,
                    letterSpacing: -1,
                  }}
                >
                  h
                </Text>
              </View>

              {/* meta */}
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    fontFamily: "Geist-600",
                    fontSize: 18,
                    color: colors.fgPrimary,
                    letterSpacing: -0.4,
                    lineHeight: 21,
                  }}
                >
                  Personal workspace
                </Text>
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: type.label,
                    color: colors.fgMuted,
                    letterSpacing: 0.5,
                  }}
                >
                  {projectCount} PROJECTS · SINCE 2023
                </Text>
              </View>

              {/* PRO badge */}
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: `${colors.accent}60`,
                  backgroundColor: `${colors.accent}14`,
                }}
              >
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 10,
                    letterSpacing: 1,
                    color: colors.accent,
                  }}
                >
                  PRO
                </Text>
              </View>
            </View>
          </LiquidGlass>

          {/* ── 2. WORKSPACE ─────────────────────────────────────────────── */}
          <View style={{ gap: 8 }}>
            <Eyebrow>Workspace</Eyebrow>
            <LiquidGlass padding={0}>
              <SetRow
                label="Projects"
                value={String(projectCount)}
                onPress={() => haptic.tap()}
              />
              <SetRow
                label="Default project"
                value="All projects"
                onPress={() => haptic.tap()}
              />
              <SetRow
                label="Monthly revenue target"
                sub="ad revenue progress"
                value={
                  goal.data?.target_amount != null
                    ? `${goal.data.target_amount.toLocaleString()} ${goal.data.currency}`
                    : "Not set"
                }
                onPress={promptGoal}
              />
              <SetRow
                label="Revenue multiplier"
                sub="local display only"
                value={`${revenueMultiplier.toFixed(2)}x`}
                valueColor={revenueMultiplier > 1 ? colors.accentWarn : colors.fgSecondary}
                onPress={promptRevenueMultiplier}
              />
              <SetRow
                label="Plan & billing"
                sub="pro · monthly"
                value="$19/mo"
                onPress={() => haptic.tap()}
                isLast
              />
            </LiquidGlass>
          </View>

          {/* ── 3. DATA SOURCES ──────────────────────────────────────────── */}
          <View style={{ gap: 8 }}>
            <Eyebrow>{`Data sources · ${okCount}/${totalIntegrations} ok`}</Eyebrow>
            <LiquidGlass padding={0}>
              {integrations.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: 10.5,
                      letterSpacing: 0.6,
                      color: colors.fgSubtle,
                    }}
                  >
                    NO INTEGRATIONS CONFIGURED
                  </Text>
                </View>
              ) : (
                integrations.map((integ, i) => (
                  <View
                    key={integ.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: i === integrations.length - 1 ? 0 : 1,
                      borderBottomColor: "rgba(255,255,255,0.055)",
                    }}
                  >
                    <StatusDot color={integStatusColor(integ.status)} />

                    <View style={{ flex: 1, gap: 2, marginLeft: 10 }}>
                      <Text
                        style={{
                          fontFamily: "Geist-500",
                          fontSize: type.body,
                          color: colors.fgPrimary,
                          letterSpacing: -0.1,
                          textTransform: "capitalize",
                        }}
                      >
                        {integ.provider}
                      </Text>
                      {integ.propertyName != null ? (
                        <Text
                          style={{
                            fontFamily: "GeistMono-500",
                            fontSize: type.label,
                            color: colors.fgSubtle,
                            letterSpacing: 0.3,
                          }}
                          numberOfLines={1}
                        >
                          {integ.propertyName}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={{
                        fontFamily: "GeistMono-500",
                        fontSize: type.bodySm,
                        color: integStatusColor(integ.status),
                        letterSpacing: 0.2,
                      }}
                    >
                      {integStatusLabel(integ.status)}
                    </Text>
                  </View>
                ))
              )}
            </LiquidGlass>
          </View>

          {/* ── 4. ALERTS & NOTIFICATIONS ────────────────────────────────── */}
          <View style={{ gap: 8 }}>
            <Eyebrow>Alerts & notifications</Eyebrow>
            <LiquidGlass padding={0}>
              <SetRow
                label="Alert rules"
                value={`${alertRules.data ?? 0} active`}
                onPress={() => haptic.tap()}
              />
              <SetRow
                label="Push notifications"
                right={
                  <Toggle
                    on={pushEnabled}
                    onChange={(v) => {
                      haptic.tap();
                      setPushEnabled(v);
                    }}
                  />
                }
              />
              <SetRow
                label="Critical only"
                sub="mute warnings"
                right={
                  <Toggle
                    on={criticalOnly}
                    onChange={(v) => {
                      haptic.tap();
                      setCriticalOnly(v);
                    }}
                  />
                }
              />
              <SetRow
                label="Quiet hours"
                value="23:00 – 08:00"
                onPress={() => haptic.tap()}
                isLast
              />
            </LiquidGlass>
          </View>

          {/* ── 5. APPEARANCE ────────────────────────────────────────────── */}
          <View style={{ gap: 8 }}>
            <Eyebrow>Appearance</Eyebrow>
            <LiquidGlass padding={0}>
              <SetRow
                label="Currency"
                right={
                  <Seg<Currency>
                    value={currency}
                    options={["USD", "EUR", "TRY"]}
                    onChange={(c) => {
                      haptic.tap();
                      preferences.setCurrency(c);
                    }}
                  />
                }
              />
              <SetRow
                label="Theme"
                value="Dark"
              />
              <SetRow
                label="Accent"
                value="Lime"
                isLast
              />
            </LiquidGlass>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: type.label,
                color: colors.fgSubtle,
                letterSpacing: 0.5,
                textAlign: "center",
              }}
            >
              ACCENT & GLASS TUNED IN v1 — LIME ONLY
            </Text>
          </View>

          {/* ── 6. WIDGETS & SYNC ────────────────────────────────────────── */}
          <View style={{ gap: 8 }}>
            <Eyebrow>Widgets & sync</Eyebrow>
            <LiquidGlass padding={0}>
              <SetRow
                label="Home screen widget"
                right={
                  <Toggle
                    on={widgetEnabled}
                    onChange={(v) => {
                      haptic.tap();
                      setWidgetEnabled(v);
                    }}
                  />
                }
              />
              <SetRow
                label="Sync frequency"
                value="Every 5 min"
              />
              <SetRow
                label="Revenue priority"
                sub="load earnings first"
                right={
                  <Toggle
                    on={prioritizeRevenueRequests}
                    onChange={(v) => {
                      haptic.tap();
                      preferences.setPrioritizeRevenueRequests(v);
                    }}
                  />
                }
              />
              <SetRow
                label="Last sync"
                value={lastSyncAt ? formatRelativeTime(lastSyncAt) : "—"}
                isLast
              />
            </LiquidGlass>
          </View>

          {/* ── 7. ABOUT ─────────────────────────────────────────────────── */}
          <View style={{ gap: 8 }}>
            <Eyebrow>About</Eyebrow>
            <LiquidGlass padding={0}>
              <SetRow
                label="Help & support"
                onPress={() => haptic.tap()}
              />
              <SetRow
                label="Privacy & data"
                onPress={() => haptic.tap()}
              />
              <SetRow
                label="Version"
                value="1.0.0 · #142"
              />
              <SetRow
                label="Sign out"
                danger
                onPress={() => {
                  haptic.tap();
                  supabase.auth.signOut();
                }}
                isLast
              />
            </LiquidGlass>
          </View>

          {/* footer */}
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: type.label,
              color: colors.fgSubtle,
              letterSpacing: 0.6,
              textAlign: "center",
              paddingTop: 8,
            }}
          >
            HELM · LIQUID GLASS · v1.0.0
          </Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
