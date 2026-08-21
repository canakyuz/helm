import { useMemo, useState } from "react";
import { Link } from "react-router";
import { type CrudFilter, useList } from "@refinedev/core";
import { ClipboardList, ExternalLink, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScope } from "@/context/scope";
import type { AuditLog, Project } from "@/types";

const ACTION_LABELS: Record<string, string> = {
  ban: "Banla",
  unban: "Ban kaldır",
  set_metadata: "Metadata değiştir",
  send_password_reset: "Şifre sıfırla",
  delete_user: "Kullanıcı sil",
};

const actionBadge = (action: string) => {
  const label = ACTION_LABELS[action] ?? action;
  if (action === "ban" || action === "delete_user") {
    return <Badge variant="destructive">{label}</Badge>;
  }
  if (action === "unban") {
    return (
      <Badge className="border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        {label}
      </Badge>
    );
  }
  return <Badge variant="secondary">{label}</Badge>;
};

export const AuditPage = () => {
  const { scope, isAll } = useScope();
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const filters: CrudFilter[] = [];
  if (!isAll) {
    filters.push({ field: "project_id", operator: "eq", value: scope });
  }
  if (actionFilter !== "all") {
    filters.push({ field: "action", operator: "eq", value: actionFilter });
  }

  const { result, query } = useList<AuditLog>({
    resource: "audit_log",
    filters,
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const logs = result.data;

  const { result: projResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projectName = (id: string | null) =>
    id ? projResult.data.find((p) => p.id === id)?.name ?? "-" : "-";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter(
      (l) =>
        (l.target_user ?? "").toLowerCase().includes(needle) ||
        (l.detail ?? "").toLowerCase().includes(needle),
    );
  }, [logs, q]);

  // KPI hesapları
  const stats = useMemo(() => {
    const monthAgo = Date.now() - 30 * 86_400_000;
    const recent = logs.filter(
      (l) => new Date(l.created_at).getTime() >= monthAgo,
    );
    // Aksiyon türü dağılımı
    const byAction = new Map<string, number>();
    for (const l of logs) {
      byAction.set(l.action, (byAction.get(l.action) ?? 0) + 1);
    }
    const topAction = [...byAction.entries()].sort((a, b) => b[1] - a[1])[0];
    // En aktif yönetici
    const byActor = new Map<string, number>();
    for (const l of logs) {
      const a = l.actor_email ?? "sistem";
      byActor.set(a, (byActor.get(a) ?? 0) + 1);
    }
    const topActor = [...byActor.entries()].sort((a, b) => b[1] - a[1])[0];
    // Benzersiz hedef kullanıcı
    const uniqueTargets = new Set(
      logs.map((l) => l.target_user).filter(Boolean),
    ).size;
    return {
      total: logs.length,
      lastMonth: recent.length,
      topActionLabel: topAction
        ? `${ACTION_LABELS[topAction[0]] ?? topAction[0]}`
        : "-",
      topActionCount: topAction?.[1] ?? 0,
      topActor: topActor?.[0] ?? "-",
      topActorCount: topActor?.[1] ?? 0,
      uniqueTargets,
    };
  }, [logs]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Müdahale Geçmişi
      </h1>

      {/* KPI cluster */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AuditKpi
          label="Toplam işlem"
          value={stats.total}
        />
        <AuditKpi
          label="Son 30g"
          value={stats.lastMonth}
          tone="primary"
        />
        <AuditKpi
          label={`En sık: ${stats.topActionLabel}`}
          value={stats.topActionCount}
        />
        <AuditKpi
          label={`En Aktif: ${stats.topActor.slice(0, 16)}${stats.topActor.length > 16 ? "…" : ""}`}
          value={stats.topActorCount}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı müdahaleleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Kullanıcı UUID veya detay ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm işlemler</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 && !query.isLoading ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title={
                logs.length === 0
                  ? "Henüz müdahale kaydı yok"
                  : "Filtreye uyan kayıt yok"
              }
              description={
                logs.length === 0
                  ? "Kullanıcılar → herhangi bir kullanıcının detayını aç → ban / premium / şifre sıfırla / sil. Her işlem burada birikir (kim, ne zaman, kime, ne)."
                  : "Filtreyi gevşet, aramayı temizle veya işlem türünü Tüm işlemler yap."
              }
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  {isAll && <TableHead>Proje</TableHead>}
                  <TableHead>Yapan</TableHead>
                  <TableHead>İşlem</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Detay</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(l.created_at).toLocaleString("tr-TR")}
                    </TableCell>
                    {isAll && (
                      <TableCell className="text-xs">
                        {projectName(l.project_id)}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">
                      {l.actor_email ?? (
                        <span className="text-muted-foreground">sistem</span>
                      )}
                    </TableCell>
                    <TableCell>{actionBadge(l.action)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.target_user ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                      {l.detail ?? ""}
                    </TableCell>
                    <TableCell>
                      {l.target_user && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Kullanıcıya git"
                        >
                          <Link to={`/users/${l.target_user}`}>
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
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

const AuditKpi = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "primary";
}) => (
  <div className="rounded-lg border bg-card p-3">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div
      className={`mt-1 text-2xl tabular-nums ${tone === "primary" ? "text-primary" : "text-foreground"}`}
    >
      {value}
    </div>
  </div>
);
