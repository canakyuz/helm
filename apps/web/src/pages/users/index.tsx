import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useScope } from "@/context/scope";

interface ProjectUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export const UsersPage = () => {
  const { scope, isAll } = useScope();
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAll) {
      setUsers([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabaseClient.functions
      .invoke("helm-users", { body: { project_id: scope } })
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
  }, [scope, isAll]);

  const fmt = (value: string | null) =>
    value ? new Date(value).toLocaleString("tr-TR") : "—";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Kullanıcılar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Proje kullanıcıları</CardTitle>
        </CardHeader>
        <CardContent>
          {isAll ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Kullanıcıları görmek için sidebar'dan bir proje seç.
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
            <>
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
              <p className="mt-3 text-xs text-muted-foreground">
                {users.length} kullanıcı (ilk 200)
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
