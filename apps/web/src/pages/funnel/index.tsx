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
}

interface FunnelResponse {
  days: number;
  steps: FunnelStep[];
  total_entered: number;
  total_converted: number;
  overall_conversion: number;
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
              loading={loading}
            />
          </div>

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
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <FunnelShape steps={data.steps} />
                <FunnelTable steps={data.steps} />
              </div>
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

/* ───────────────────────── Trapezoid SVG funnel ───────────────────────── */

const stepFill = (stepPct: number, isFirst: boolean) => {
  if (isFirst) return "#6366f1"; // indigo
  if (stepPct >= 80) return "#10b981"; // emerald
  if (stepPct >= 40) return "#f59e0b"; // amber
  return "#ef4444"; // red
};

const stepTextClass = (stepPct: number, isFirst: boolean) => {
  if (isFirst) return "text-indigo-500";
  if (stepPct >= 80) return "text-emerald-500";
  if (stepPct >= 40) return "text-amber-500";
  return "text-destructive";
};

const FunnelShape = ({ steps }: { steps: FunnelStep[] }) => {
  if (steps.length === 0) return null;
  const first = steps[0].count;
  const ROW = 56;
  const PAD = 8;
  const VBW = 100; // viewBox width
  const totalH = steps.length * ROW + PAD * 2;

  // Her satır için top/bottom width (önceki count → bu count akışı)
  const rows = steps.map((s, i) => {
    const topRatio = i === 0 ? 1 : steps[i - 1].count / first;
    const botRatio = s.count / first;
    const top = Math.max(topRatio * VBW, 1);
    const bot = Math.max(botRatio * VBW, 1);
    return {
      step: s,
      topW: top,
      botW: bot,
      y: PAD + i * ROW,
    };
  });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VBW} ${totalH}`}
        preserveAspectRatio="none"
        className="block h-auto w-full"
        style={{ minHeight: totalH * 4 }}
      >
        {rows.map((r, i) => {
          const tl = (VBW - r.topW) / 2;
          const tr = tl + r.topW;
          const bl = (VBW - r.botW) / 2;
          const br = bl + r.botW;
          const fill = stepFill(r.step.step_pct, i === 0);
          return (
            <polygon
              key={i}
              points={`${tl},${r.y} ${tr},${r.y} ${br},${r.y + ROW - 4} ${bl},${r.y + ROW - 4}`}
              fill={fill}
              fillOpacity={0.85}
              stroke={fill}
              strokeOpacity={0.4}
              strokeWidth={0.3}
            />
          );
        })}
      </svg>

      {/* Overlay: her satır için event adı + count (HTML, SVG dışı — text aspect-fix sorunu olmasın) */}
      <div className="absolute inset-0 flex flex-col px-2 py-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className="relative flex flex-1 items-center justify-center"
          >
            <div className="pointer-events-none flex items-center gap-2 rounded-md bg-background/80 px-2 py-0.5 text-xs backdrop-blur-sm">
              <span className="font-mono text-[10px] text-muted-foreground">
                #{i + 1}
              </span>
              <code className="max-w-[180px] truncate font-mono text-xs font-medium">
                {r.step.event}
              </code>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {compact(r.step.count)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────── Detay tablo (sağ taraf) ───────────────────────── */

const FunnelTable = ({ steps }: { steps: FunnelStep[] }) => (
  <div className="space-y-1">
    <div className="grid grid-cols-[24px_minmax(0,1fr)_56px_56px] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      <span>#</span>
      <span>Adım</span>
      <span className="text-right">Adım</span>
      <span className="text-right">Toplam</span>
    </div>
    {steps.map((s, i) => {
      const isFirst = i === 0;
      const cls = stepTextClass(s.step_pct, isFirst);
      return (
        <div
          key={`${s.event}-${i}`}
          className="grid grid-cols-[24px_minmax(0,1fr)_56px_56px] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-muted/40"
        >
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0">
            <code className="block truncate font-mono text-xs font-medium">
              {s.event}
            </code>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
              <span className="font-mono">{compact(s.count)}</span>
              {!isFirst && s.drop > 0 && (
                <>
                  <ArrowDown className="size-2.5 text-destructive" />
                  <span className="font-mono text-destructive">
                    −{compact(s.drop)}
                  </span>
                </>
              )}
            </div>
          </div>
          <span
            className={cn(
              "text-right font-mono text-xs font-semibold tabular-nums",
              cls,
            )}
          >
            {isFirst ? "—" : `%${s.step_pct.toFixed(0)}`}
          </span>
          <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
            %{s.overall_pct.toFixed(1)}
          </span>
        </div>
      );
    })}
  </div>
);
