import { useEffect, useState } from "react";
import { useList } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabaseClient } from "@/providers/supabase-client";
import type { Project } from "@/types";

interface ProjectUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export const UsersPage = () => {
  const { result } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projects = result.data;

  const [projectId, setProjectId] = useState<string>("");
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabaseClient.functions
      .invoke("helm-users", { body: { project_id: projectId } })
      .then(({ data, error: fnError }) => {
        if (cancelled) return;
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        setUsers(data?.users ?? []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const fmt = (value: string | null) =>
    value ? new Date(value).toLocaleString("tr-TR") : "—";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Kullanıcılar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Proje kullanıcıları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Proje seç" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id!}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!projectId ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Kullanıcılarını görmek için bir proje seç
            </div>
          ) : loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Kullanıcı bulunamadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Kayıt</TableHead>
                  <TableHead>Son giriş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmt(u.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmt(u.last_sign_in_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {projectId && !loading && !error && users.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {users.length} kullanıcı (ilk 200)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
