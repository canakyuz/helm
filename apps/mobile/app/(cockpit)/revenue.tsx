import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space, radius as R, press, withAlpha } from "@helm/design";
import { weekRange, type RevenueBucket } from "@helm/api";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useProperties } from "~/hooks/use-properties";
import { usePayouts } from "~/hooks/use-payouts";
import { useMrrMovement } from "~/hooks/use-mrr-movement";
import { useRevenueHistory } from "~/hooks/use-revenue-history";
import { useRevenueEvents } from "~/hooks/use-revenue-events";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger, formatRatio } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { usePreferences } from "~/lib/preferences";
import { monthLabel, MONTHS_SHORT, localToday } from "~/lib/labels";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { CountUp } from "~/components/liquid";
import { PaymentsTile, ReconciliationTile } from "~/components/revenue";
import {
  BentoBackground,
  HERO_NUMBER,
  MiniTile,
  BentoBars,
  BentoHeader,
  BentoRails,
  BentoSegment,
  BentoStack,
  BentoTile,
  Rise,
  SolidTile,
  type RailRow,
} from "~/components/bento";

/** Dönem pili yüksekliği — yatay ScrollView'a açıkça verilmeli (bkz PeriodStrip). */
const PILL_H = 40;

const GRAINS = ["Ay", "Hafta"] as const;
type Grain = (typeof GRAINS)[number];


/** Kaynak renkleri — seri ladder'i (pos/neg/warn DURUM renkleri, seri degil). */
/** Kaynak renkleri. Reklam = secili accent (ana gelir kalemi), digerleri sabit seri. */
function sourceTint(metric: string, accent: string): string {
  if (metric === "ad_revenue") return accent;
  if (metric === "subscription_revenue") return "#B89CFF";
  if (metric === "iap_revenue") return "#7AA8FF";
  return "#FF8A3D";
}

/** API etiketleri Ingilizce ve web ile paylasiliyor; metrik anahtarindan cevrilir. */
const SOURCE_LABEL: Record<string, string> = {
  ad_revenue: "Reklam",
  subscription_revenue: "Abonelik",
  iap_revenue: "Uygulama içi",
};


/** Hafta kovasi → "5–11 Ağu". */
function weekLabel(bucket: RevenueBucket): string {
  const { from, to } = weekRange(bucket);
  const [, , fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  return `${fd}–${td} ${MONTHS_SHORT[(tm ?? 1) - 1]}`;
}

export default function Revenue() {
  const todayIso = localToday();
  const { theme, glass } = useTheme();
  const fmt = useFormatCurrency();
  const [grain, setGrain] = useState<Grain>("Ay");
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const { selectedPropertyId, prioritizeRevenueRequests } = usePreferences();
  const { refreshing, onRefresh } = useScreenRefresh();
  const [replayKey, setReplayKey] = useState(0);

  const history = useRevenueHistory();
  const events = useRevenueEvents();
  const ready = !prioritizeRevenueRequests || history.data != null || history.isError;
  const kpis = useCockpitKpis({ enabled: ready });
  const properties = useProperties({ enabled: ready });
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;
      
  const buckets = useMemo(
    () => (grain === "Ay" ? (history.data?.months ?? []) : (history.data?.weeks ?? [])),
    [history.data, grain],
  );

  // Secili kova. Granularite degisince eski anahtar gecersiz kalir — en guncel
  // doneme duser, bos ekran gostermez.
  const picked = useMemo(
    () => buckets.find((b) => b.key === pickedKey) ?? buckets[0] ?? null,
    [buckets, pickedKey],
  );

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  if (history.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (history.isError) return <ScreenStatus label="Gelir yüklenemedi" tone="danger" />;

  const periodMrr = picked?.mrr ?? kpis.data?.mrr ?? 0;
  const periodSubs = picked?.activeSubs ?? kpis.data?.activeSubs ?? 0;
  const arppu = periodSubs > 0 ? periodMrr / periodSubs : 0;

  // Sifir kalan kaynak gizlenir — "bagli ama uretmiyor" izlenimi vermesin.
  // Ilk sifir-disi degerde kendiliginden geri gelir (activeSources API'den).
  const sources = (history.data?.activeSources ?? []).map((metric) => ({
    metric,
    value: picked?.bySource[metric] ?? 0,
  }));

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="GELİR"
          title="Kazanç"
          onSync={handleRefresh}
          syncing={refreshing}
          picker
        />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screenX,
            paddingBottom: 120,
            gap: space.tileGap,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              tintColor={theme.fg}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <Rise index={0} replayKey={replayKey}>
            <BentoTile padding={space.tilePadLg}>
              <View className="flex-row items-center justify-between">
                <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
                  TOPLAM GELİR
                </Text>
                <BentoSegment
                  options={GRAINS}
                  value={grain}
                  onChange={(g) => {
                    setGrain(g);
                    setPickedKey(null);
                  }}
                  mono={false}
                />
              </View>

              <CountUp
                value={picked?.total ?? 0}
                format={fmt}
                fitOneLine
                style={{ ...HERO_NUMBER, color: theme.fg }}
              />
              <Text className="mt-[6px] text-meta text-fg2">
                {picked == null
                  ? "Veri yok"
                  : `${grain === "Ay" ? monthLabel(picked.key) : weekLabel(picked)} · ${picked.days.length} gün`}
              </Text>

              {/* Kaynak kirilimi — toplamin NEREDEN geldigi, dogrudan burada */}
              {sources.length > 0 && picked != null ? (
                <>
                  <View className="mt-tilePad">
                    <BentoStack
                      parts={sources.map((s) => ({
                        ratio: picked.total > 0 ? s.value / picked.total : 0,
                        color: sourceTint(s.metric, theme.accent),
                      }))}
                    />
                  </View>
                  <View className="mt-headerY gap-sm">
                    {sources.map((s) => (
                      <View key={s.metric} className="flex-row items-center gap-[10px]">
                        <View
                          className="h-[9px] w-[9px] rounded-bar"
                          style={{ backgroundColor: sourceTint(s.metric, theme.accent) }}
                        />
                        <Text className="flex-1 font-medium text-row text-fg">
                          {SOURCE_LABEL[s.metric] ?? s.metric}
                        </Text>
                        <Text className="font-semibold text-row tracking-tight text-fg">
                          {fmt(s.value)}
                        </Text>
                        <Text className="w-[38px] text-right font-mono-medium text-[11px] text-fg3">
                          {formatRatio(picked.total > 0 ? s.value / picked.total : 0)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {picked != null && picked.days.length > 1 ? (
                <View className="mt-tilePad">
                  <BentoBars
                    points={picked.days}
                    activeColor={theme.accent}
                    dimColor={glass.chartDim}
                    height={64}
                    gap={3}
                    // Vurgu "bugun" demek. Gecmis bir donemde son gunu
                    // vurgulamak yanlis bir "su an" ima eder; -1 hicbir
                    // cubugu esitlemez, tamami sonuk kalir.
                    selectedIndex={picked.days.some((d) => d.date === todayIso) ? null : -1}
                    replayKey={replayKey}
                  />
                </View>
              ) : null}
            </BentoTile>
          </Rise>

          {/* Donem gezinmesi — yatay kaydirmali, en guncel solda */}
          <Rise index={1} replayKey={replayKey}>
            <PeriodStrip
              buckets={buckets}
              activeKey={picked?.key ?? null}
              grain={grain}
              onPick={(k) => {
                haptic.tap();
                setPickedKey(k);
              }}
            />
          </Rise>

          <View className="flex-row gap-tileGap">
            <Rise index={2} replayKey={replayKey} style={{ flex: 1 }}>
              <SolidTile color={theme.accent} padding={space.tilePadSm}>
                <Text className="font-mono-medium text-eyebrow tracking-wide"
                  style={{ color: withAlpha(theme.accentInk, 0.78) }}>
                  MRR
                </Text>
                <Text
                  className="mt-sm font-semibold text-stat tracking-tightest"
                  style={{ color: theme.accentInk }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fmt(picked?.mrr ?? kpis.data?.mrr ?? 0)}
                </Text>
              </SolidTile>
            </Rise>
            {/* ARPPU: donem MRR'i / donem abonesi. Eskiden ARPU idi ama donem
                MRR'ini GUNCEL kullanici sayisina bolmek iki farkli zamani
                karistiriyordu. */}
            <MiniTile index={3} replayKey={replayKey} label="ARPPU" value={fmt(arppu)} />
            <MiniTile
              index={4}
              replayKey={replayKey}
              label="ABONE"
              value={formatInteger(picked?.activeSubs ?? kpis.data?.activeSubs ?? 0)}
            />
          </View>

          {/* Anlik/kesin mutabakat — hangi para dogrulandi, hangisi bekliyor. */}
          {picked != null && picked.legs.length > 0 ? (
            <Rise index={5} replayKey={replayKey}>
              <ReconciliationTile legs={picked.legs} fmt={fmt} />
            </Rise>
          ) : null}

          <Rise index={6} replayKey={replayKey}>
            <PaymentsTile
              payments={picked?.payments ?? []}
              loading={history.isLoading}
              fmt={fmt}
            />
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Donem seridi ─────────────────────────────────────────────────────────────

function PeriodStrip({
  buckets,
  activeKey,
  grain,
  onPick,
}: {
  buckets: readonly RevenueBucket[];
  activeKey: string | null;
  grain: Grain;
  onPick: (key: string) => void;
}) {
  const { theme } = useTheme();

  if (buckets.length === 0) return null;

  return (
    // AÇIK YÜKSEKLİK ŞART: dikey ScrollView içindeki yatay ScrollView'ın
    // yüksekliği sıfıra düşüyor. iOS çocukları yine de çiziyor (varsayılan
    // olarak kırpmaz) ama sınırların DIŞINDAKİ dokunuşları iletmiyor — piller
    // görünür ama tıklanamaz oluyordu. flexGrow:0 tek başına yetmez.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: PILL_H, flexGrow: 0 }}
      contentContainerStyle={{ gap: 6, alignItems: "center" }}
    >
      {buckets.map((b) => {
        const active = b.key === activeKey;
        return (
          <Pressable key={b.key} onPress={() => onPick(b.key)} accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={{
                  height: PILL_H,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  borderRadius: R.field,
                  backgroundColor: active ? theme.chrome : theme.tile2,
                  borderWidth: 1,
                  borderColor: active ? theme.fg3 : "transparent",
                  opacity: pressed && !active ? press.opacity : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: active ? "Geist-600" : "Geist-500",
                    fontSize: 12,
                    color: active ? theme.fg : theme.fg2,
                  }}
                >
                  {grain === "Ay" ? monthLabel(b.key) : weekLabel(b)}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Alt gorunumler ───────────────────────────────────────────────────────────

// ─── Ortak parcalar ───────────────────────────────────────────────────────────

