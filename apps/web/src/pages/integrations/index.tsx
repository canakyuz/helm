import { useMemo } from "react";
import { useList } from "@refinedev/core";
import {
  CheckCircle2,
  Plug,
  RefreshCw,
  Sparkles,
  Unplug,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { useScope } from "@/context/scope";
import { CATEGORY_LABELS, PROVIDER_META } from "@/lib/integrations";
import { cn } from "@/lib/utils";
import type { ProjectIntegration, ProviderName } from "@/types";
import { PROVIDER_LABELS } from "@/types";

export const IntegrationsPage = () => {
  const { scope, isAll } = useScope();

  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: isAll
      ? []
      : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const integrations = integResult.data;

  const stats = useMemo(() => {
    const totalProviders = Object.keys(PROVIDER_LABELS).length;
    const connected = integrations.length;
    const enabled = integrations.filter((i) => i.enabled).length;
    const ok = integrations.filter((i) => i.last_sync_status === "ok").length;
    const errored = integrations.filter(
      (i) => i.last_sync_status === "error",
    ).length;
    const pending = integrations.filter(
      (i) => i.enabled && !i.last_sync_status,
    ).length;
    const categoryCounts: Record<string, number> = {};
    for (const i of integrations) {
      const cat = PROVIDER_META[i.provider as ProviderName]?.category;
      if (cat) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
    return {
      totalProviders,
      connected,
      enabled,
      ok,
      errored,
      pending,
      categoryCount: Object.keys(categoryCounts).length,
    };
  }, [integrations]);

  if (isAll) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Entegrasyonlar
        </h1>
        <Card>
          <CardContent>
            <EmptyState
              icon={<Plug className="size-6" />}
              title="Bir proje seç"
              description="Integrations are per-property. Use the switcher at the top of the sidebar to pick one - nothing can be added while All properties is selected."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Entegrasyonlar
        </h1>
        <div className="text-xs text-muted-foreground">
          <span className="tabular-nums">{stats.connected}</span> /{" "}
          <span className="tabular-nums">{stats.totalProviders}</span>{" "}
          sağlayıcı bağlı
        </div>
      </div>

      {/* KPI cluster - 6'lı */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiPill
          label="Bağlı"
          value={`${stats.connected} / ${stats.totalProviders}`}
          icon={<Plug className="size-3.5" />}
        />
        <KpiPill
          label="Aktif"
          value={stats.enabled}
          icon={<CheckCircle2 className="size-3.5" />}
          tone="emerald"
        />
        <KpiPill
          label="Sağlıklı"
          value={stats.ok}
          icon={<Sparkles className="size-3.5" />}
          tone="emerald"
        />
        <KpiPill
          label="Hatalı"
          value={stats.errored}
          icon={<XCircle className="size-3.5" />}
          tone={stats.errored > 0 ? "destructive" : undefined}
        />
        <KpiPill
          label="Bekliyor"
          value={stats.pending}
          icon={<RefreshCw className="size-3.5" />}
          tone={stats.pending > 0 ? "amber" : undefined}
        />
        <KpiPill
          label="Kategori"
          value={stats.categoryCount}
          icon={<Unplug className="size-3.5" />}
        />
      </div>

      <IntegrationsPanel projectId={scope} />

      <div className="text-xs text-muted-foreground">
        Kategoriler:{" "}
        {(
          Object.entries(CATEGORY_LABELS) as Array<[string, string]>
        ).map(([k, label], i) => (
          <span key={k}>
            {i > 0 && " · "}
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const KpiPill = ({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "emerald" | "amber" | "destructive";
}) => {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneCls)}>
        {value}
      </div>
    </div>
  );
};
