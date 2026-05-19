import { useList } from "@refinedev/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PROVIDER_LABELS,
  type Project,
  type ProjectIntegration,
  type SyncRun,
} from "@/types";

export const SystemPage = () => {
  const { result: runsResult } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    pagination: { mode: "off" },
  });
  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });

  const runs = runsResult.data;
  const integrations = integResult.data;
  const projectName = (id: string) =>
    projectsResult.data.find((p) => p.id === id)?.name ?? "—";

  const statusBadge = (it: ProjectIntegration) => {
    if (it.last_sync_status === "ok") {
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
          sağlıklı
        </Badge>
      );
    }
    if (it.last_sync_status === "error") {
      return <Badge variant="destructive">hata</Badge>;
    }
    return <Badge variant="secondary">beklemede</Badge>;
  };

  const fmt = (value: string | null) =>
    value ? new Date(value).toLocaleString("tr-TR") : "—";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Senkron & Sağlık
      </h1>

      {/* Connector sağlığı */}
      <Card>
        <CardHeader>
          <CardTitle>Veri Kaynağı Sağlığı</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Bağlı veri kaynağı yok
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proje</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son senkron</TableHead>
                  <TableHead>Hata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      {projectName(it.project_id)}
                    </TableCell>
                    <TableCell>{PROVIDER_LABELS[it.provider]}</TableCell>
                    <TableCell>{statusBadge(it)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmt(it.last_synced_at)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-destructive">
                      {it.last_sync_error ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Senkron geçmişi */}
      <Card>
        <CardHeader>
          <CardTitle>Senkron Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz senkron çalışmadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Tetikleyici</TableHead>
                  <TableHead>Metrik</TableHead>
                  <TableHead>Sonuç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice(0, 20).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {new Date(r.started_at).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {r.trigger === "cron" ? "otomatik" : "manuel"}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.ingested}</TableCell>
                    <TableCell>
                      {r.error_count > 0 ? (
                        <Badge variant="destructive">
                          {r.error_count} hata
                        </Badge>
                      ) : (
                        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                          {r.ok_count} ok
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
