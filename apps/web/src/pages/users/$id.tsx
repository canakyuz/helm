import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useInvalidate, useList } from "@refinedev/core";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  KeyRound,
  Mail,
  Shield,
  ShieldOff,
  Sparkles,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

interface CrmTable {
  name: string;
  user_col: string;
  rows: Record<string, unknown>[] | null;
  error?: string;
}

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-US") : "—";

const isBanned = (u: UserDetail) => {
  if (!u.banned_until) return false;
  return new Date(u.banned_until).getTime() > Date.now();
};

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { scope, isAll } = useScope();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [tables, setTables] = useState<CrmTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        setTables((data?.tables as CrmTable[]) ?? []);
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
  }, [scope, isAll, id, reloadKey]);

  const runAction = async (
    action: string,
    params?: Record<string, unknown>,
    opts: { successMsg?: string; afterDelete?: boolean } = {},
  ) => {
    if (!id) return;
    setActing(action);
    try {
      const { data, error: fnError } = await supabaseClient.functions.invoke(
        "helm-action",
        { body: { project_id: scope, user_id: id, action, params } },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast.success(opts.successMsg ?? "Tamam", {
        description: data?.detail,
      });
      invalidate({ resource: "audit_log", invalidates: ["list"] });
      if (opts.afterDelete) {
        navigate("/users");
      } else {
        setReloadKey((k) => k + 1);
      }
    } catch (e) {
      toast.error("Action failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setActing(null);
    }
  };

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
  const isPremium = Boolean(
    (user.app_metadata as { premium?: unknown })?.premium,
  );
  const busy = acting !== null;

  return (
    <div className="space-y-4">
      <BackBar />

      {/* Üst bilgi şeridi */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                {isPremium && (
                  <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-500">
                    <Sparkles className="mr-1 size-3" /> premium
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
            <div className="flex flex-wrap gap-2">
              {banned ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    runAction("unban", undefined, {
                      successMsg: "Unbanned",
                    })
                  }
                >
                  <ShieldOff className="size-4" />
                  <span className="ml-2">Unban</span>
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={busy}>
                      <Ban className="size-4" />
                      <span className="ml-2">Banla</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {user.email} banlansın mı?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Kullanıcı 100 yıl boyunca banlanır (kalıcı). Banı
                        sonradan kaldırabilirsin.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          runAction("ban", undefined, {
                            successMsg: "Banned",
                          })
                        }
                      >
                        Banla
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  runAction(
                    "set_metadata",
                    { scope: "app", patch: { premium: !isPremium } },
                    {
                      successMsg: isPremium
                        ? "Premium disabled"
                        : "Premium enabled",
                    },
                  )
                }
              >
                <Sparkles className="size-4" />
                <span className="ml-2">
                  {isPremium ? "Premium kapat" : "Enable premium"}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !user.email}
                onClick={() =>
                  runAction("send_password_reset", undefined, {
                    successMsg: "Password reset link sent",
                  })
                }
                title={!user.email ? "This user has no email" : undefined}
              >
                <KeyRound className="size-4" />
                <span className="ml-2">Reset password</span>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    <span className="ml-2">Sil</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {user.email} silinsin mi?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Bu işlem geri alınamaz. Kullanıcının auth kaydı
                      tamamen silinir. Uygulamadaki bağlı satırlar (profiles
                      vb.) cascade ayarına göre etkilenir.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        runAction("delete_user", undefined, {
                          successMsg: "User deleted",
                          afterDelete: true,
                        })
                      }
                    >
                      Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

              <dt className="text-muted-foreground">Signup</dt>
              <dd>{fmt(user.created_at)}</dd>

              <dt className="text-muted-foreground">Last updated</dt>
              <dd>{fmt(user.updated_at)}</dd>

              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd>{fmt(user.last_sign_in_at)}</dd>

              <dt className="text-muted-foreground">Email confirmed</dt>
              <dd>{fmt(user.email_confirmed_at)}</dd>

              <dt className="text-muted-foreground">Phone confirmed</dt>
              <dd>{fmt(user.phone_confirmed_at)}</dd>

              <dt className="text-muted-foreground">Ban ends</dt>
              <dd>{fmt(user.banned_until)}</dd>

              <dt className="text-muted-foreground">Providers</dt>
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
            <CardTitle>Intervention history</CardTitle>
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
                        {new Date(l.created_at).toLocaleString("en-US")}
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

      {/* Proje-spesifik CRM tabloları */}
      {tables.length > 0 && (
        <div className="space-y-4">
          {tables.map((t) => (
            <Card key={t.name}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="font-mono">{t.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    .{t.user_col} = user.id
                  </span>
                  {t.rows && (
                    <Badge variant="secondary">{t.rows.length} satır</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {t.error ? (
                  <div className="text-sm text-destructive">{t.error}</div>
                ) : !t.rows || t.rows.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Bu tabloda kayıt yok
                  </div>
                ) : (
                  <div className="overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(t.rows[0]).map((col) => (
                            <TableHead key={col} className="whitespace-nowrap">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.rows.map((row, i) => (
                          <TableRow key={i}>
                            {Object.keys(t.rows![0]).map((col) => (
                              <TableCell
                                key={col}
                                className="whitespace-nowrap font-mono text-xs"
                              >
                                {formatCell(row[col])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const formatCell = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "✓" : "✗";
  return String(v);
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
