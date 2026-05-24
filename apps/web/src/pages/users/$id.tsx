import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useList } from "@refinedev/core";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Mail,
  Shield,
  ShieldOff,
  User as UserIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { AuditLog } from "@/types";

interface UserDetail {
  id: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
  updated_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  banned_until: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities: Array<{
    provider?: string;
    id?: string;
    created_at?: string;
  }>;
}

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("tr-TR") : "—";

const isBanned = (u: UserDetail) => {
  if (!u.banned_until) return false;
  return new Date(u.banned_until).getTime() > Date.now();
};

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { scope, isAll } = useScope();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAll || !id) {
      setUser(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabaseClient.functions
      .invoke("helm-user-detail", {
        body: { project_id: scope, user_id: id },
      })
      .then(({ data, error: fnError }) => {
        if (cancelled) return;
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        setUser(data?.user ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, isAll, id]);

  // Bu kullanıcıya yönelik audit log
  const { result: auditResult } = useList<AuditLog>({
    resource: "audit_log",
    filters: id ? [{ field: "target_user", operator: "eq", value: id }] : [],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!id },
  });
  const auditLogs = auditResult.data;

  if (isAll) {
    return (
      <div className="space-y-4">
        <BackBar />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Kullanıcı detayı için sidebar'dan bir proje seç.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <BackBar />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackBar />
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <BackBar />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Kullanıcı bulunamadı
          </CardContent>
        </Card>
      </div>
    );
  }

  const banned = isBanned(user);

  return (
    <div className="space-y-4">
      <BackBar />

      {/* Üst bilgi şeridi */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="size-5" />
                {user.email ?? "(e-posta yok)"}
              </CardTitle>
              <div className="font-mono text-xs text-muted-foreground">
                {user.id}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {banned ? (
                  <Badge variant="destructive">
                    <Ban className="mr-1 size-3" /> banlı
                  </Badge>
                ) : (
                  <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                    <CheckCircle2 className="mr-1 size-3" /> aktif
                  </Badge>
                )}
                {user.email_confirmed_at && (
                  <Badge variant="secondary">
                    <Mail className="mr-1 size-3" /> e-posta onaylı
                  </Badge>
                )}
                {user.role && (
                  <Badge variant="outline">
                    <Shield className="mr-1 size-3" /> {user.role}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                title="C katmanı — yakında"
              >
                {banned ? <ShieldOff className="size-4" /> : <Ban className="size-4" />}
                <span className="ml-2">{banned ? "Banı kaldır" : "Banla"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                title="C katmanı — yakında"
              >
                <Shield className="size-4" />
                <span className="ml-2">Premium</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Auth detayı */}
        <Card>
          <CardHeader>
            <CardTitle>Auth bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">E-posta</dt>
              <dd className="font-mono">{user.email ?? "—"}</dd>

              <dt className="text-muted-foreground">Telefon</dt>
              <dd className="font-mono">{user.phone ?? "—"}</dd>

              <dt className="text-muted-foreground">Kayıt</dt>
              <dd>{fmt(user.created_at)}</dd>

              <dt className="text-muted-foreground">Son güncelleme</dt>
              <dd>{fmt(user.updated_at)}</dd>

              <dt className="text-muted-foreground">Son giriş</dt>
              <dd>{fmt(user.last_sign_in_at)}</dd>

              <dt className="text-muted-foreground">E-posta onayı</dt>
              <dd>{fmt(user.email_confirmed_at)}</dd>

              <dt className="text-muted-foreground">Telefon onayı</dt>
              <dd>{fmt(user.phone_confirmed_at)}</dd>

              <dt className="text-muted-foreground">Ban bitiş</dt>
              <dd>{fmt(user.banned_until)}</dd>

              <dt className="text-muted-foreground">Sağlayıcılar</dt>
              <dd className="space-x-1">
                {user.identities.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  user.identities.map((i, idx) => (
                    <Badge key={idx} variant="secondary">
                      {i.provider}
                    </Badge>
                  ))
                )}
              </dd>
            </dl>
          </CardContent>
        </Card>

        {/* Müdahale geçmişi */}
        <Card>
          <CardHeader>
            <CardTitle>Müdahale geçmişi</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Bu kullanıcıya yönelik müdahale yok
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaman</TableHead>
                    <TableHead>Aksiyon</TableHead>
                    <TableHead>Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">
                        {new Date(l.created_at).toLocaleString("tr-TR")}
                      </TableCell>
                      <TableCell>{l.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.detail ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata kutuları */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">user_metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-72 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(user.user_metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">app_metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-72 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(user.app_metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const BackBar = () => (
  <div className="flex items-center gap-2">
    <Button asChild variant="ghost" size="sm">
      <Link to="/users">
        <ArrowLeft className="size-4" />
        Kullanıcılar
      </Link>
    </Button>
  </div>
);
