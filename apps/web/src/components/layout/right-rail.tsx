import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useList } from "@refinedev/core";
import { Activity, AlertOctagon, Bell, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AlertEvent, SyncRun } from "@/types";

interface CityClock {
  name: string;
  tz: string;
}

const CITIES: CityClock[] = [
  { name: "Istanbul", tz: "Europe/Istanbul" },
  { name: "New York", tz: "America/New_York" },
  { name: "Londra", tz: "Europe/London" },
  { name: "Tokyo", tz: "Asia/Tokyo" },
];

const timeAgo = (iso: string | null) => {
  if (!iso) return "never";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
};

/** Dünya saatleri — 4 şehir, dakikada bir refresh. Airlinesim referansı. */
const WorldClock = () => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    }).format(now);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="size-4" /> Dünya Saatleri
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {CITIES.map((c) => (
          <div key={c.tz} className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {c.name}
            </div>
            <div className="font-mono text-lg tabular-nums">{fmt(c.tz)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/** Son 48 saatte açılan uyarı sayısı + en yenilerin özeti. */
const OpenAlerts = () => {
  const since48h = useMemo(
    () => new Date(Date.now() - 48 * 3_600_000).toISOString(),
    [],
  );
  const { result } = useList<AlertEvent>({
    resource: "alert_events",
    filters: [{ field: "triggered_at", operator: "gte", value: since48h }],
    sorters: [{ field: "triggered_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const alerts = result.data;
  const top3 = alerts.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Bell className="size-4" /> Açık Uyarılar
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              alerts.length > 0
                ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
                : "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30",
            )}
          >
            {alerts.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {alerts.length === 0 ? (
          <div className="text-muted-foreground">No alerts in the last 48 hours.</div>
        ) : (
          <>
            {top3.map((a) => (
              <Link
                key={a.id}
                to="/alerts"
                className="block rounded-md px-2 py-1.5 ring-1 ring-foreground/5 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-2">
                  <AlertOctagon className="size-3 text-destructive" />
                  <span className="truncate font-medium">{a.metric}</span>
                </div>
                <div className="mt-0.5 truncate text-muted-foreground">
                  {a.message}
                </div>
              </Link>
            ))}
            {alerts.length > 3 && (
              <Link
                to="/alerts"
                className="block text-center text-muted-foreground hover:text-foreground"
              >
                +{alerts.length - 3} daha →
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

/** Son senkron durumu + cron sağlığı özeti. */
const SyncStatus = () => {
  const { result } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const last = result.data[0];
  const stale =
    !last?.started_at ||
    Date.now() - new Date(last.started_at).getTime() > 3 * 3_600_000;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="size-4" /> Senkron
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last run</span>
          <span className="font-mono tabular-nums">
            {timeAgo(last?.started_at ?? null)}
          </span>
        </div>
        {last && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fetched</span>
              <span className="font-mono tabular-nums">{last.ingested}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">OK / errors</span>
              <span className="font-mono tabular-nums">
                {last.ok_count}/{last.error_count}
              </span>
            </div>
          </>
        )}
        {stale && (
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive">
            Cron 3+ saattir çalışmadı.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/** Dashboard'a özel sağ widget pane — World Clock, Alerts, Sync. */
export const RightRail = () => (
  <aside className="hidden xl:flex w-[320px] shrink-0 flex-col gap-4">
    <WorldClock />
    <OpenAlerts />
    <SyncStatus />
  </aside>
);
