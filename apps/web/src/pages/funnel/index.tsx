import { useEffect, useMemo, useState } from "react";
import { useInvalidate, useList, useUpdate } from "@refinedev/core";
import {
  ArrowDown,
  Pencil,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RangeSelect } from "@/components/range-select";
import { StatCard } from "@/components/stat-card";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import { compact } from "@/lib/metrics";
import type { ProjectIntegration } from "@/types";

interface FunnelStep {
  event: string;
  order: number;
  count: number;
  overall_pct: number;
  step_pct: number;
  drop: number;
  prev_count?: number;
  delta_pct?: number | null;
}

interface FunnelResponse {
  days: number;
  steps: FunnelStep[];
  total_entered: number;
  total_converted: number;
  overall_conversion: number;
  prev_total_entered?: number;
  prev_total_converted?: number;
  prev_overall_conversion?: number;
}

interface PHEvent {
  name: string;
  last_seen_at: string | null;
  volume_30_day: number | null;
  system: boolean;
}

export const FunnelPage = () => {
  const { scope, isAll } = useScope();
  const invalidate = useInvalidate();
  const { mutate: update } = useUpdate();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FunnelResponse | null>(null);

  const [events, setEvents] = useState<PHEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [pickedEvents, setPickedEvents] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: isAll
      ? []
      : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const phIntg = integResult.data.find(
    (i) => i.provider === "posthog" && i.enabled,
  );
  const phCfg = (phIntg?.config ?? {}) as {
    funnel_steps?: string;
    [k: string]: unknown;
  };
  const stepsConfigured =
    !!phCfg.funnel_steps && phCfg.funnel_steps.split(",").length >= 2;

  const load = useMemo(
    () => async () => {
      if (isAll || !phIntg || !stepsConfigured) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: res, error: fnErr } = await supabaseClient.functions.invoke(
          "helm-funnel",
          { body: { project_id: scope, days } },
        );
        if (fnErr) throw fnErr;
        if (res?.error) throw new Error(res.error);
        setData(res as FunnelResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [scope, isAll, days, phIntg, stepsConfigured],
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadEvents = useMemo(
    () => async () => {
      if (isAll || !phIntg) {
        setEvents([]);
        return;
      }
      setEventsLoading(true);
      try {
        const { data: res, error: fnErr } =
          await supabaseClient.functions.invoke("helm-posthog-events", {
            body: { project_id: scope },
          });
        if (fnErr) throw fnErr;
        if (res?.error) throw new Error(res.error);
        setEvents((res?.events as PHEvent[]) ?? []);
      } catch (e) {
        toast.error("Event listesi alınamadı", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setEventsLoading(false);
      }
    },
    [scope, isAll, phIntg],
  );

  useEffect(() => {
    if (!stepsConfigured && phIntg && !isAll) {
      loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepsConfigured, phIntg, isAll, scope]);

  // İlk yüklendiğinde mevcut step'leri pickedEvents'a koy
  useEffect(() => {
    if (phCfg.funnel_steps) {
      setPickedEvents(
        phCfg.funnel_steps
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else {
      setPickedEvents([]);
    }
  }, [phCfg.funnel_steps]);

  const toggleEvent = (name: string) => {
    setPickedEvents((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  };

  const saveFunnelSteps = () => {
    if (!phIntg) return;
    if (pickedEvents.length < 2) {
      toast.error("En az 2 adım seç");
      return;
    }
    const newConfig = {
      ...(phIntg.config ?? {}),
      funnel_steps: pickedEvents.join(", "),
    };
    update(
      {
        resource: "project_integrations",
        id: phIntg.id,
        values: { config: newConfig },
      },
      {
        onSuccess: () => {
          toast.success("Huni adımları kaydedildi");
          setEditing(false);
          invalidate({
            resource: "project_integrations",
            invalidates: ["list"],
          });
        },
      },
    );
  };

  const showPicker = !stepsConfigured || editing;

  const maxCount = data?.steps[0]?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Huni</h1>
        <div className="flex items-center gap-2">
          <RangeSelect value={days} onChange={setDays} />
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading || isAll || !stepsConfigured}
          >
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
            <span className="ml-2">Yenile</span>
          </Button>
        </div>
      </div>

      {isAll && (
        <ErrorBanner variant="warning">
          Huni için sidebar'dan bir proje seç.
        </ErrorBanner>
      )}

      {!isAll && !phIntg && (
        <ErrorBanner variant="warning" title="PostHog bağlı değil">
          Entegrasyonlar → <strong>+</strong> → PostHog → Project ID + Personal
          API Key.
        </ErrorBanner>
      )}

      {!isAll && phIntg && showPicker && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Huni adımlarını seç
            </CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                {editing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setPickedEvents(
                        phCfg.funnel_steps
                          ?.split(",")
                          .map((s) => s.trim())
                          .filter(Boolean) ?? [],
                      );
                    }}
                  >
                    Vazgeç
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadEvents}
                  disabled={eventsLoading}
                >
                  <RefreshCw
                    className={`size-4 ${eventsLoading ? "animate-spin" : ""}`}
                  />
                  <span className="ml-2">Yenile</span>
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <ErrorBanner variant="warning" title="İdeal: 3-5 adım">
              <div className="space-y-1">
                <div>
                  6+ adımda her drop küçük görünür, conversion neredeyse hep %0
                  çıkar. Funnel ≠ event log — kullanıcı yolculuğunun{" "}
                  <strong>ana</strong> kilometre taşlarını seç.
                </div>
                <div className="text-xs opacity-80">
                  Tipik mobil oyun: <code>app_opened</code> →{" "}
                  <code>tutorial_complete</code> → <code>level_5</code> →{" "}
                  <code>first_purchase</code>
                </div>
              </div>
            </ErrorBanner>

            {eventsLoading && events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Yükleniyor…
              </div>
            ) : events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Event yok. PostHog'a hiç event geldi mi?
              </div>
            ) : (
              <div className="max-h-96 overflow-auto rounded-md border">
                <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                  {events
                    .filter((e) => !e.system)
                    .slice(0, 60)
                    .map((e) => {
                      const picked = pickedEvents.includes(e.name);
                      const order = pickedEvents.indexOf(e.name) + 1;
                      return (
                        <button
                          key={e.name}
                          type="button"
                          onClick={() => toggleEvent(e.name)}
                          className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                            picked
                              ? "border-primary/40 bg-primary/10"
                              : "border-transparent hover:bg-muted"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {picked && (
                              <Badge className="border-primary/30 bg-primary/20 text-primary tabular-nums">
                                {order}
                              </Badge>
                            )}
                            <code className="font-mono text-xs">{e.name}</code>
                          </span>
                          {e.volume_30_day !== null && (
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              {compact(e.volume_30_day)} / 30g
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {pickedEvents.length > 0 && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 text-xs text-muted-foreground">
                  Seçim ({pickedEvents.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {pickedEvents.map((e, i) => (
                    <Badge
                      key={e}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => toggleEvent(e)}
                      title="Tıkla → kaldır"
                    >
                      <span className="mr-1 font-mono">{i + 1}.</span>
                      <code>{e}</code>
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={saveFunnelSteps}
                    disabled={pickedEvents.length < 2}
                  >
                    Kaydet ({pickedEvents.length} adım)
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickedEvents([])}
                  >
                    Temizle
                  </Button>
                </div>
              </div>
            )}

            {events.filter((e) => e.system).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Sistem event'leri ($pageview, $autocapture, …)
                </summary>
                <div className="mt-2 flex flex-wrap gap-1">
                  {events
                    .filter((e) => e.system)
                    .slice(0, 30)
                    .map((e) => (
                      <button
                        key={e.name}
                        type="button"
                        onClick={() => toggleEvent(e.name)}
                        className="rounded border px-2 py-0.5 font-mono text-[10px] hover:bg-muted"
                      >
                        {e.name}
                      </button>
                    ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && !showPicker && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Huniye Girenler"
              value={compact(data.total_entered)}
              icon={<Users />}
              loading={loading}
            />
            <StatCard
              title="Sonuna Ulaşanlar"
              value={compact(data.total_converted)}
              icon={<Users />}
              loading={loading}
            />
            <StatCard
              title="Toplam Dönüşüm"
              value={`%${data.overall_conversion.toFixed(1)}`}
              icon={
                data.overall_conversion >= 50 ? (
                  <TrendingUp />
                ) : (
                  <TrendingDown />
                )
              }
              delta={
                data.prev_overall_conversion !== undefined &&
                data.prev_overall_conversion > 0
                  ? ((data.overall_conversion -
                      data.prev_overall_conversion) /
                      data.prev_overall_conversion) *
                    100
                  : null
              }
              loading={loading}
            />
          </div>

          {/* Önceki periyot karşılaştırma şeridi */}
          {data.prev_total_entered !== undefined &&
            data.prev_total_entered > 0 && (
              <div className="rounded-lg border bg-card/40 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-muted-foreground">
                    Önceki {data.days}g ile karşılaştırma:
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Girenler</span>
                    <ChangeBadge
                      current={data.total_entered}
                      prev={data.prev_total_entered}
                    />
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Sonuna ulaşan</span>
                    <ChangeBadge
                      current={data.total_converted}
                      prev={data.prev_total_converted ?? 0}
                    />
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Dönüşüm %</span>
                    <ChangeBadge
                      current={data.overall_conversion}
                      prev={data.prev_overall_conversion ?? 0}
                      suffix="pp"
                    />
                  </span>
                </div>
              </div>
            )}

          {data.steps.length > 6 && (
            <ErrorBanner variant="warning">
              <strong>{data.steps.length} adım çok fazla</strong> — her küçük
              adım toplam conversion'u baltalar. Sağ üstteki{" "}
              <strong>Adımları düzenle</strong> ile 3-5 ana kilometre taşına
              indir.
            </ErrorBanner>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                Onboarding Hunisi — son {days} gün
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {data.steps.length} adım · sıralı · unique user
                </span>
              </CardTitle>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    loadEvents();
                  }}
                >
                  <Pencil className="size-4" />
                  <span className="ml-2">Adımları düzenle</span>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FunnelBars steps={data.steps} />
            </CardContent>
          </Card>
        </>
      )}

      {!data && !loading && !error && !isAll && stepsConfigured && (
        <Card>
          <CardContent>
            <EmptyState
              icon={<TrendingDown className="size-6" />}
              title="Veri yok"
              description="PostHog'tan funnel sonucu boş döndü. Adımlardaki event isimlerinin doğru olduğundan emin ol (case-sensitive) — Adımları düzenle ile kontrol et."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* ───────────────────────── FunnelBars (Mixpanel/Amplitude tarzı) ───────────────────────── */
//
// Yatay bar liste — her adım için tek satır:
//   • Üst: event adı + count + toplam%
//   • Bar: solda kalan (renkli), sağda kaybedilen (gri) — kademeli renk
//   • Aralarda drop indicator: kaç kişi düştü, ne kalan %, önceki periyot delta

const barFill = (stepPct: number, isFirst: boolean) => {
  if (isFirst) return "bg-indigo-500";
  if (stepPct >= 80) return "bg-emerald-500";
  if (stepPct >= 40) return "bg-amber-500";
  return "bg-destructive";
};

const barTextClass = (stepPct: number, isFirst: boolean) => {
  if (isFirst) return "text-indigo-500";
  if (stepPct >= 80) return "text-emerald-500";
  if (stepPct >= 40) return "text-amber-500";
  return "text-destructive";
};

const FunnelBars = ({ steps }: { steps: FunnelStep[] }) => {
  if (steps.length === 0) return null;
  const first = steps[0].count;

  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const isFirst = i === 0;
        const overallPct = first > 0 ? (s.count / first) * 100 : 0;
        const stepClass = barFill(s.step_pct, isFirst);
        const textClass = barTextClass(s.step_pct, isFirst);

        return (
          <div key={`${s.event}-${i}`}>
            {/* Drop indicator (önceki adım → bu adım arasında) */}
            {!isFirst && (
              <div className="mb-2 ml-10 flex items-center gap-3 text-xs">
                <div className="flex h-px flex-1 items-center">
                  <div className="h-px w-full bg-border" />
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono tabular-nums",
                    s.step_pct >= 80
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : s.step_pct >= 40
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                        : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  <ArrowDown className="size-3" />
                  <span>
                    %{s.step_pct.toFixed(0)} kalan
                    {s.drop > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        · −{compact(s.drop)} kişi
                      </span>
                    )}
                  </span>
                  {s.delta_pct !== null && s.delta_pct !== undefined && (
                    <span
                      className={cn(
                        "ml-1 border-l border-current/20 pl-2",
                        s.delta_pct >= 0
                          ? "text-emerald-500"
                          : "text-destructive",
                      )}
                      title={`Önceki periyot: ${s.prev_count ?? 0}`}
                    >
                      {s.delta_pct >= 0 ? "▲" : "▼"}{" "}
                      {Math.abs(s.delta_pct).toFixed(0)}%
                    </span>
                  )}
                </span>
                <div className="h-px w-12 bg-border" />
              </div>
            )}

            {/* Adım satırı */}
            <div className="rounded-lg border bg-card/30 p-3">
              {/* Üst satır: # + event + count + toplam% */}
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2.5">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    #{i + 1}
                  </span>
                  <code className="truncate font-mono text-sm font-medium">
                    {s.event}
                  </code>
                </div>
                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="font-mono text-2xl font-semibold tabular-nums">
                    {compact(s.count)}
                  </span>
                  <span
                    className={cn(
                      "w-16 text-right font-mono text-sm font-medium tabular-nums",
                      textClass,
                    )}
                  >
                    %{overallPct.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Yatay bar (kademeli daralan) */}
              <div className="relative h-3 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all",
                    stepClass,
                  )}
                  style={{ width: `${Math.max(overallPct, 0.5)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChangeBadge = ({
  current,
  prev,
  suffix,
}: {
  current: number;
  prev: number;
  suffix?: string;
}) => {
  if (prev === 0) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {compact(current)} (önceki: 0)
      </span>
    );
  }
  const diff = current - prev;
  const pct = suffix === "pp" ? diff : (diff / prev) * 100;
  const positive = diff >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs tabular-nums",
        positive ? "text-emerald-500" : "text-destructive",
      )}
    >
      <span>
        {suffix === "pp"
          ? `${current.toFixed(1)} vs ${prev.toFixed(1)}`
          : `${compact(current)} vs ${compact(prev)}`}
      </span>
      <span>
        ({positive ? "+" : ""}
        {pct.toFixed(suffix === "pp" ? 1 : 0)}
        {suffix === "pp" ? " pp" : "%"})
      </span>
    </span>
  );
};
