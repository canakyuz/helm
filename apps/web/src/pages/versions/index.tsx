import { useState } from "react";
import { type CrudFilter, useInvalidate, useList } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import type { AppVersion, Project } from "@/types";

export const VersionsPage = () => {
  const { scope, isAll } = useScope();
  const invalidate = useInvalidate();
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-versions",
        { body: {} },
      );
      if (error) throw error;
      toast.success("Sürümler güncellendi", {
        description: `${data?.versions ?? 0} sürüm bulundu.`,
      });
      invalidate({ resource: "app_versions", invalidates: ["list"] });
    } catch (e) {
      toast.error("Güncelleme başarısız", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRefreshing(false);
    }
  };

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

      <Card>
        <CardHeader>
          <CardTitle>App Store Sürümleri</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 && !query.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sürüm yok. Proje detayında "Düzenle" → App Store ID gir, sonra
              "Yenile".
            </div>
          ) : (
            <div className="divide-y">
              {versions.map((v) => (
                <div key={v.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">v{v.version}</Badge>
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
                  </div>
                  {v.release_notes && (
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {v.release_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
