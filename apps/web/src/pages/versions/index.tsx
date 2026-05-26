import { useMemo, useState } from "react";
import { type CrudFilter, useInvalidate, useList } from "@refinedev/core";
import { Apple, Globe, Package, RefreshCw, Smartphone } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import type { AppVersion, Project } from "@/types";

type Source = "all" | "ios" | "android";

export const VersionsPage = () => {
  const { scope, isAll } = useScope();
  const invalidate = useInvalidate();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Source>("all");

  const filters: CrudFilter[] = [];
  if (!isAll) {
    filters.push({ field: "project_id", operator: "eq", value: scope });
  }
  const { result, query } = useList<AppVersion>({
    resource: "app_versions",
    filters,
    sorters: [{ field: "release_date", order: "desc" }],
    pagination: { mode: "off" },
  });
  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const versions = result.data;
  const projectName = (id: string) =>
    projectsResult.data.find((p) => p.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    if (tab === "all") return versions;
    return versions.filter((v) => v.source === tab);
  }, [versions, tab]);

  const iosCount = versions.filter((v) => v.source === "ios").length;
  const androidCount = versions.filter((v) => v.source === "android").length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-versions",
        { body: {} },
      );
      if (error) throw error;
      toast.success("Sürümler güncellendi", {
        description: `${data?.ios ?? 0} iOS, ${data?.android ?? 0} Android — toplam ${data?.versions ?? 0}`,
      });
      if (data?.errors?.length) {
        toast.warning("Bazı sürümler çekilemedi", {
          description: data.errors.slice(0, 2).join("\n"),
        });
      }
      invalidate({ resource: "app_versions", invalidates: ["list"] });
    } catch (e) {
      toast.error("Güncelleme başarısız", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRefreshing(false);
    }
  };

  // KPI: en son iOS + en son Android + son güncelleme + cross-platform property sayısı
  const latestIos = useMemo(
    () =>
      versions
        .filter((v) => v.source === "ios")
        .sort((a, b) => {
          const ad = a.release_date ? new Date(a.release_date).getTime() : 0;
          const bd = b.release_date ? new Date(b.release_date).getTime() : 0;
          return bd - ad;
        })[0],
    [versions],
  );
  const latestAndroid = useMemo(
    () =>
      versions
        .filter((v) => v.source === "android")
        .sort((a, b) => {
          const ad = a.release_date ? new Date(a.release_date).getTime() : 0;
          const bd = b.release_date ? new Date(b.release_date).getTime() : 0;
          return bd - ad;
        })[0],
    [versions],
  );
  const lastUpdate = useMemo(() => {
    const dates = versions
      .map((v) => v.release_date ?? v.fetched_at)
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());
    return dates.length > 0 ? Math.max(...dates) : null;
  }, [versions]);
  const lastUpdateRel = lastUpdate
    ? (() => {
        const days = Math.floor((Date.now() - lastUpdate) / 86_400_000);
        if (days === 0) return "bugün";
        if (days === 1) return "dün";
        if (days < 30) return `${days} g`;
        return `${Math.floor(days / 30)} ay`;
      })()
    : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sürümler</h1>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw
            className={refreshing ? "size-4 animate-spin" : "size-4"}
          />
          Yenile
        </Button>
      </div>

      {/* KPI cluster */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <VerKpi
          label="iOS Toplam"
          value={iosCount}
          icon={<Apple className="size-3.5" />}
        />
        <VerKpi
          label="Android Toplam"
          value={androidCount}
          icon={<Smartphone className="size-3.5" />}
          tone="emerald"
        />
        <VerKpi
          label="En Yeni iOS"
          value={latestIos?.version ? `v${latestIos.version}` : "—"}
          icon={<Package className="size-3.5" />}
        />
        <VerKpi
          label={`Son Güncelleme (${lastUpdateRel})`}
          value={latestAndroid?.version ? `v${latestAndroid.version}` : "—"}
          icon={<Package className="size-3.5" />}
          tone="primary"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Source)}>
        <TabsList>
          <TabsTrigger value="all">
            <Globe className="size-4" />
            <span className="ml-2">
              Tümü
              <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                {versions.length}
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="ios">
            <Apple className="size-4" />
            <span className="ml-2">
              iOS
              <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                {iosCount}
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="android">
            <Smartphone className="size-4" />
            <span className="ml-2">
              Android
              <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                {androidCount}
              </span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tab === "ios"
                  ? "App Store Sürümleri"
                  : tab === "android"
                    ? "Play Store Sürümleri"
                    : "Tüm Sürümler"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 && !query.isLoading ? (
                <EmptyState
                  icon={<Package className="size-6" />}
                  title={
                    versions.length === 0
                      ? "Sürüm yok"
                      : `${tab === "ios" ? "iOS" : "Android"} sürüm yok`
                  }
                  description={
                    versions.length === 0 ? (
                      <>
                        <strong>Settings → Integrations</strong> → App Store
                        Connect veya Google Play Developer bağla, ya da Property
                        → <strong>Düzenle</strong> ile{" "}
                        <code>app_store_id</code> /{" "}
                        <code>google_play_id</code> gir. Sonra{" "}
                        <strong>Yenile</strong> — iOS iTunes lookup, Android
                        Play Store scrape.
                      </>
                    ) : (
                      "Diğer tab'da olabilir veya bu mağazada bağlantı yok."
                    )
                  }
                  compact
                />
              ) : (
                <div className="divide-y">
                  {filtered.map((v) => {
                    const expiresInDays = v.expires_at
                      ? Math.ceil(
                          (new Date(v.expires_at).getTime() - Date.now()) /
                            86_400_000,
                        )
                      : null;
                    return (
                      <div key={v.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <SourceBadge source={v.source} />
                          <Badge variant="secondary">
                            v{v.version}
                            {v.build_number ? ` (${v.build_number})` : ""}
                          </Badge>
                          <StatusBadge status={v.status} />
                          {isAll && (
                            <span className="text-sm font-medium">
                              {projectName(v.project_id)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {v.release_date
                              ? new Date(v.release_date).toLocaleDateString(
                                  "tr-TR",
                                )
                              : ""}
                          </span>
                          {expiresInDays !== null && expiresInDays > 0 && (
                            <span className="text-xs text-amber-500">
                              {expiresInDays}g sonra dolar
                            </span>
                          )}
                        </div>
                        {v.release_notes && (
                          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                            {v.release_notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatusBadge = ({ status }: { status: AppVersion["status"] }) => {
  if (!status) return null;
  const config: Record<string, { label: string; cls: string }> = {
    live: { label: "CANLI", cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-500" },
    in_review: { label: "İNCELEMEDE", cls: "border-amber-500/30 bg-amber-500/15 text-amber-500" },
    ready: { label: "HAZIR", cls: "border-blue-500/30 bg-blue-500/15 text-blue-500" },
    testflight: { label: "TESTFLIGHT", cls: "border-violet-500/30 bg-violet-500/15 text-violet-500" },
    rejected: { label: "RED", cls: "border-destructive/30 bg-destructive/15 text-destructive" },
    expired: { label: "SÜRE DOLDU", cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
    removed: { label: "KALDIRILDI", cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
    unknown: { label: "—", cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
  };
  const c = config[status] ?? config.unknown;
  return <Badge className={`${c.cls} text-[10px]`}>{c.label}</Badge>;
};

const SourceBadge = ({ source }: { source: "ios" | "android" }) => {
  if (source === "ios") {
    return (
      <Badge className="border-foreground/20 bg-foreground/5">
        <Apple className="size-3" />
        <span className="ml-1">iOS</span>
      </Badge>
    );
  }
  return (
    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
      <Smartphone className="size-3" />
      <span className="ml-1">Android</span>
    </Badge>
  );
};

const VerKpi = ({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "emerald" | "primary";
}) => {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-500"
      : tone === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl tabular-nums ${toneCls}`}>
        {value}
      </div>
    </div>
  );
};
