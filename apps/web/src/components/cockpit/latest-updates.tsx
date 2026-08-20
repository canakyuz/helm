import { useMemo, useState } from "react";
import { AlertTriangle, Bell, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AlertEvent, SyncRun } from "@/types";

type TabKey = "today" | "yesterday" | "week";

const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "week", label: "Bu hafta" },
];

interface Activity {
  id: string;
  at: string;
  title: string;
  subtitle: string;
  kind: "alert" | "sync-ok" | "sync-error";
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const startOfDay = (offsetDays: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d.getTime();
};

/** Alert + sync olaylarını tek timeline'a indirger. Time: O(n log n) (sort). */
const buildActivities = (alerts: AlertEvent[], runs: SyncRun[]): Activity[] => {
  const items: Activity[] = [];
  for (const a of alerts) {
    items.push({
      id: `alert-${a.id}`,
      at: a.triggered_at,
      title: "Alert tetiklendi",
      subtitle: a.message || a.metric,
      kind: "alert",
    });
  }
  for (const r of runs) {
    items.push({
      id: `run-${r.id}`,
      at: r.started_at,
      title: r.error_count > 0 ? "Sync hatalı bitti" : "Sync tamamlandı",
      subtitle: `${r.ingested} metrik · ${r.ok_count} ok${
        r.error_count > 0 ? ` · ${r.error_count} hata` : ""
      } · ${r.trigger}`,
      kind: r.error_count > 0 ? "sync-error" : "sync-ok",
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
};

const ICON: Record<Activity["kind"], { node: typeof Bell; cls: string }> = {
  alert: { node: Bell, cls: "bg-amber-50 text-amber-600 dark:bg-amber-500/10" },
  "sync-ok": {
    node: RefreshCw,
    cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
  },
  "sync-error": {
    node: AlertTriangle,
    cls: "bg-red-50 text-red-600 dark:bg-red-500/10",
  },
};

interface LatestUpdatesProps {
  alerts: AlertEvent[];
  runs: SyncRun[];
  className?: string;
}

/** Kravio "Latest Updates" paneli: segmented tab + arama + ikonlu timeline. */
export const LatestUpdates = ({ alerts, runs, className }: LatestUpdatesProps) => {
  const [tab, setTab] = useState<TabKey>("today");
  const [q, setQ] = useState("");

  const all = useMemo(() => buildActivities(alerts, runs), [alerts, runs]);

  const filtered = useMemo(() => {
    const today = startOfDay(0);
    const yesterday = startOfDay(1);
    const week = startOfDay(6);
    const inTab = all.filter((a) => {
      const t = new Date(a.at).getTime();
      if (tab === "today") return t >= today;
      if (tab === "yesterday") return t >= yesterday && t < today;
      return t >= week;
    });
    if (!q.trim()) return inTab;
    const needle = q.toLowerCase();
    return inTab.filter(
      (a) =>
        a.title.toLowerCase().includes(needle) ||
        a.subtitle.toLowerCase().includes(needle),
    );
  }, [all, tab, q]);

  const todayCount = useMemo(() => {
    const today = startOfDay(0);
    return all.filter((a) => new Date(a.at).getTime() >= today).length;
  }, [all]);

  return (
    <Card className={cn("py-0", className)}>
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Son Aktiviteler
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5 pt-3">
        {/* Segmented tabs - aktif koyu (Kravio "Today") */}
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Arama */}
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px]">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Aktivite ara"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        <p className="text-sm">
          <span className="font-semibold">{todayCount}</span>{" "}
          <span className="text-muted-foreground">yeni aktivite bugün</span>
        </p>

        <div className="h-px w-full border-t border-dashed border-border" />

        {/* Timeline - dikey bağlantı çizgisi + ikon çipleri */}
        {filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center py-8 text-xs text-muted-foreground">
            Bu aralıkta aktivite yok
          </div>
        ) : (
          <ul className="relative flex-1 space-y-4 overflow-y-auto pr-1">
            {filtered.slice(0, 12).map((a, i, arr) => {
              const { node: Icon, cls } = ICON[a.kind];
              return (
                <li key={a.id} className="relative flex gap-3 pl-0.5">
                  {i < arr.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[18px] top-9 h-[calc(100%-16px)] w-px bg-border"
                    />
                  )}
                  <span
                    className={cn(
                      "z-10 grid size-8 shrink-0 place-items-center rounded-lg",
                      cls,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold">
                        {a.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeLabel(a.at)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.subtitle}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
