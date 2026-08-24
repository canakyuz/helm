import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Ban,
  BellRing,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Search,
  Shield,
  Sparkles,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import { cn } from "@/lib/utils";

interface ProjectUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned: boolean;
  premium: boolean;
  premium_tier: number | null;
  premium_expires_at: string | null;
  providers: string[];
  username: string | null;
  display_name: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  location: string | null;
  avatar_url: string | null;
}

// İki harfli ülke kodu → bayrak emoji (US → 🇺🇸). Geçersizse boş.
const flag = (cc: string | null): string => {
  if (!cc || cc.length !== 2) return "";
  const base = 0x1f1e6;
  const A = "A".charCodeAt(0);
  const up = cc.toUpperCase();
  return String.fromCodePoint(
    base + (up.charCodeAt(0) - A),
    base + (up.charCodeAt(1) - A),
  );
};

type SortField = "created_at" | "last_sign_in_at" | "email";
type SortDir = "asc" | "desc";
type Tab = "all" | "new" | "active" | "inactive" | "banned" | "premium";

const PAGE = 25;
const NEW_DAYS = 7;
const ACTIVE_DAYS = 7;
const INACTIVE_DAYS = 30;

const fmt = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US");
};

const fmtRelative = (value: string | null) => {
  if (!value) return "-";
  const min = (Date.now() - new Date(value).getTime()) / 60_000;
  if (min < 60) return `${Math.round(min)} dk`;
  if (min < 1440) return `${Math.round(min / 60)} sa`;
  const days = Math.round(min / 1440);
  if (days < 30) return `${days} g`;
  if (days < 365) return `${Math.round(days / 30)} ay`;
  return `${Math.round(days / 365)}y`;
};

const initial = (u: ProjectUser) => {
  if (u.email) return u.email[0].toUpperCase();
  return "?";
};

const tabIcon = (t: Tab) => {
  switch (t) {
    case "new":
      return <UserPlus className="size-3.5" />;
    case "active":
      return <UserCheck className="size-3.5" />;
    case "inactive":
      return <UserX className="size-3.5" />;
    case "banned":
      return <Ban className="size-3.5" />;
    case "premium":
      return <Sparkles className="size-3.5" />;
    default:
      return <UsersIcon className="size-3.5" />;
  }
};

export const UsersPage = () => {
  const { scope, isAll } = useScope();

  // Bu sayfa TanStack Query'yi HIC kullanmiyordu: ham useEffect + useState ile
  // edge function'a gidiyordu. Sonucu cache'lenmedigi icin sayfaya her donusde
  // — menuden gecis, geri tusu, sekme degisimi — helm-users bastan calisiyor,
  // ekran bosaliyor ve kullanici spinner bekliyordu. Uygulamanin geri kalani
  // Refine/TanStack cache'i kullandigi icin sorun yalnizca burada gorunuyordu.
  //
  // 2 dakika: kullanici listesi metrikler kadar hizli degismiyor ve helm-users
  // pahali bir cagri (Supabase auth admin listesi + profil birlestirme).
  const {
    data: users = [],
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["helm-users", scope],
    enabled: !isAll,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error: fnError } = await supabaseClient.functions.invoke(
        "helm-users",
        { body: { project_id: scope } },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      return (data?.users ?? []) as ProjectUser[];
    },
  });
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<ProjectUser | null>(null);

  // Çoklu seçim + toplu push. Seçim sayfa/filtre değişse de yaşar;
  // sayaç her zaman gerçek seçimi gösterir.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushOpen, setPushOpen] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendBulkPush = async () => {
    if (selected.size === 0 || !pushTitle.trim() || !pushBody.trim()) return;
    setPushSending(true);
    try {
      const { data, error: fnError } = await supabaseClient.functions.invoke(
        "helm-send-push",
        {
          body: {
            project_id: scope,
            user_ids: Array.from(selected),
            title: pushTitle.trim(),
            body: pushBody.trim(),
          },
        },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.sent} bildirim gönderildi`, {
        description:
          data.recipients < selected.size
            ? `${selected.size} seçili kullanıcıdan ${data.recipients} cihazda token var`
            : `${data.recipients} cihaza ulaşıldı`,
      });
      setPushOpen(false);
      setPushTitle("");
      setPushBody("");
      setSelected(new Set());
    } catch (e) {
      toast.error("Gönderim başarısız", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPushSending(false);
    }
  };


  // KPI hesapları
  const stats = useMemo(() => {
    const nowMs = Date.now();
    const newCutoff = nowMs - NEW_DAYS * 86_400_000;
    const activeCutoff = nowMs - ACTIVE_DAYS * 86_400_000;
    const inactiveCutoff = nowMs - INACTIVE_DAYS * 86_400_000;
    let newCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;
    let bannedCount = 0;
    let premiumCount = 0;
    for (const u of users) {
      if (u.banned) bannedCount++;
      if (u.premium) premiumCount++;
      if (new Date(u.created_at).getTime() >= newCutoff) newCount++;
      const lastSign = u.last_sign_in_at
        ? new Date(u.last_sign_in_at).getTime()
        : 0;
      if (lastSign >= activeCutoff) activeCount++;
      else if (!u.last_sign_in_at || lastSign < inactiveCutoff)
        inactiveCount++;
    }
    return {
      total: users.length,
      new: newCount,
      active: activeCount,
      inactive: inactiveCount,
      banned: bannedCount,
      premium: premiumCount,
    };
  }, [users]);

  // Tab filtreleme
  const tabFiltered = useMemo(() => {
    if (tab === "all") return users;
    const nowMs = Date.now();
    return users.filter((u) => {
      const lastSign = u.last_sign_in_at
        ? new Date(u.last_sign_in_at).getTime()
        : 0;
      const created = new Date(u.created_at).getTime();
      if (tab === "new") return created >= nowMs - NEW_DAYS * 86_400_000;
      if (tab === "active")
        return lastSign >= nowMs - ACTIVE_DAYS * 86_400_000;
      if (tab === "inactive")
        return !u.last_sign_in_at || lastSign < nowMs - INACTIVE_DAYS * 86_400_000;
      if (tab === "banned") return u.banned;
      if (tab === "premium") return u.premium;
      return true;
    });
  }, [users, tab]);

  // Arama + sıralama
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? tabFiltered.filter((u) =>
          [u.email, u.id, u.username, u.display_name, u.country, u.city]
            .some((f) => (f ?? "").toLowerCase().includes(needle)),
        )
      : tabFiltered;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [tabFiltered, q, sortField, sortDir]);

  useEffect(() => setPage(0), [q, tab, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageData = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const pageStart = filtered.length === 0 ? 0 : page * PAGE + 1;
  const pageEnd = Math.min(filtered.length, (page + 1) * PAGE);

  if (isAll) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Kullanıcılar</h1>
        <Card>
          <CardContent>
            <EmptyState
              icon={<UsersIcon className="size-6" />}
              title="Bir proje seç"
              description="Kullanıcılar property bazlıdır. Listeyi hangi proje için yükleyeceğini kenar çubuğunun üstündeki seçiciden belirle."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Kullanıcılar</h1>
        <div className="text-xs text-muted-foreground">
          {stats.total > 0 && (
            <>
              <span className="tabular-nums">{stats.total}</span>{" "}
              toplam
            </>
          )}
        </div>
      </div>

      {/* KPI cluster */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiPill
          label="Toplam"
          value={stats.total}
          icon={<UsersIcon className="size-3.5" />}
        pending={loading && users.length === 0}
        />
        <KpiPill
          label={`Yeni (${NEW_DAYS}g)`}
          value={stats.new}
          icon={<CalendarPlus className="size-3.5" />}
          tone="emerald"
        pending={loading && users.length === 0}
        />
        <KpiPill
          label={`Aktif (${ACTIVE_DAYS}g)`}
          value={stats.active}
          icon={<UserCheck className="size-3.5" />}
          tone="emerald"
        pending={loading && users.length === 0}
        />
        <KpiPill
          label={`Pasif (>${INACTIVE_DAYS}g)`}
          value={stats.inactive}
          icon={<UserX className="size-3.5" />}
          tone="amber"
        pending={loading && users.length === 0}
        />
        <KpiPill
          label="Banlı"
          value={stats.banned}
          icon={<Ban className="size-3.5" />}
          tone={stats.banned > 0 ? "destructive" : undefined}
        pending={loading && users.length === 0}
        />
        <KpiPill
          label="Premium"
          value={stats.premium}
          icon={<Sparkles className="size-3.5" />}
          tone="primary"
        pending={loading && users.length === 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* Liste */}
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                {(
                  ["all", "new", "active", "inactive", "banned", "premium"] as Tab[]
                ).map((t) => (
                  <TabsTrigger key={t} value={t}>
                    {tabIcon(t)}
                    <span className="ml-1.5">
                      {t === "all"
                        ? "Tümü"
                        : t === "new"
                          ? "Yeni"
                          : t === "active"
                            ? "Aktif"
                            : t === "inactive"
                              ? "Pasif"
                              : t === "banned"
                                ? "Banlı"
                                : "Premium"}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="E-posta veya UUID ile ara…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={sortField}
                onValueChange={(v) => setSortField(v as SortField)}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Kayıt tarihi</SelectItem>
                  <SelectItem value="last_sign_in_at">Son giriş</SelectItem>
                  <SelectItem value="email">E-posta</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                }
              >
                {sortDir === "asc" ? "↑ Artan" : "↓ Azalan"}
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <div className="py-8 text-center text-sm text-destructive">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="size-6" />}
                title={
                  users.length === 0
                    ? "Henüz kullanıcı yok"
                    : "Filtreye uyan kayıt yok"
                }
                description={
                  users.length === 0
                    ? "Property'de Supabase entegrasyonu yok ya da Auth boş."
                    : "Filtreyi gevşet veya aramayı değiştir."
                }
                compact
              />
            ) : (
              <>
                {selected.size > 0 && (
                  <div className="flex items-center justify-between rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                    <span className="text-sm font-medium">
                      {selected.size} kullanıcı seçili
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setPushOpen(true)}>
                        <BellRing className="size-4" />
                        <span className="ml-1">Push gönder</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(new Set())}
                      >
                        <X className="size-4" />
                        <span className="ml-1">Temizle</span>
                      </Button>
                    </div>
                  </div>
                )}
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            aria-label="Sayfadakilerin tümünü seç"
                            checked={
                              pageData.length > 0 &&
                              pageData.every((u) => selected.has(u.id))
                            }
                            onChange={(e) => {
                              const check = e.target.checked;
                              setSelected((prev) => {
                                const next = new Set(prev);
                                for (const u of pageData) {
                                  if (check) next.add(u.id);
                                  else next.delete(u.id);
                                }
                                return next;
                              });
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-10" />
                        <TableHead>Kullanıcı</TableHead>
                        <TableHead>Konum</TableHead>
                        <TableHead>Etiketler</TableHead>
                        <TableHead className="text-right">Kayıt</TableHead>
                        <TableHead className="text-right">Son giriş</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageData.map((u) => {
                        const isSelected = preview?.id === u.id;
                        return (
                          <TableRow
                            key={u.id}
                            className={cn(
                              "cursor-pointer",
                              isSelected && "bg-primary/5",
                            )}
                            onClick={() => setPreview(u)}
                          >
                            <TableCell
                              className="py-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                aria-label="Kullanıcıyı seç"
                                checked={selected.has(u.id)}
                                onChange={() => toggleSelected(u.id)}
                              />
                            </TableCell>
                            <TableCell className="py-2">
                              <Avatar user={u} />
                            </TableCell>
                            <TableCell className="py-2">
                              {u.display_name || u.username ? (
                                <div className="truncate font-medium">
                                  {u.display_name || u.username}
                                </div>
                              ) : null}
                              {u.email ? (
                                <div
                                  className={cn(
                                    "truncate text-sm",
                                    u.display_name || u.username
                                      ? "text-muted-foreground"
                                      : "font-medium",
                                  )}
                                >
                                  {u.email}
                                </div>
                              ) : !u.display_name && !u.username ? (
                                <div className="text-sm text-muted-foreground">
                                  (e-posta yok)
                                </div>
                              ) : null}
                              <code className="font-mono text-[10px] text-muted-foreground">
                                {u.id.slice(0, 8)}…
                              </code>
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                              {u.country_code || u.country || u.city ? (
                                <div className="flex items-center gap-1.5">
                                  {flag(u.country_code) && (
                                    <span className="text-sm leading-none">
                                      {flag(u.country_code)}
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {[u.city, u.country ?? u.country_code]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </span>
                                </div>
                              ) : (
                                <span>-</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <UserBadges user={u} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-2 text-right text-xs text-muted-foreground">
                              <div>{fmt(u.created_at)}</div>
                              <div className="text-[10px] tabular-nums">
                                {fmtRelative(u.created_at)}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-2 text-right text-xs text-muted-foreground">
                              {u.last_sign_in_at ? (
                                <>
                                  <div>{fmt(u.last_sign_in_at)}</div>
                                  <div className="text-[10px] tabular-nums">
                                    {fmtRelative(u.last_sign_in_at)}
                                  </div>
                                </>
                              ) : (
                                <span className="text-muted-foreground">
                                  hiç
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              className="py-2 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                asChild
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Detay"
                              >
                                <Link to={`/users/${u.id}`}>
                                  <ExternalLink className="size-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {pageStart}–{pageEnd} / {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 tabular-nums">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={page >= totalPages - 1}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Yan panel - seçili kullanıcı önizleme */}
        <div className="space-y-4">
          <PreviewPanel user={preview} />
        </div>
      </div>

      {/* Toplu push dialogu — seçili kullanıcılara helm-send-push (user_ids) */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected.size} kullanıcıya push gönder
            </DialogTitle>
            <DialogDescription>
              Yalnızca push token'ı olan cihazlara ulaşır; sonuç toast'ta
              görünür ve kampanya geçmişine yazılır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-push-title">Başlık</Label>
              <Input
                id="bulk-push-title"
                value={pushTitle}
                maxLength={120}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Özür dileriz 💎"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-push-body">Mesaj</Label>
              <Textarea
                id="bulk-push-body"
                value={pushBody}
                rows={4}
                maxLength={500}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="Kısa, kişisel bir mesaj…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={
                pushSending || !pushTitle.trim() || !pushBody.trim()
              }
              onClick={sendBulkPush}
            >
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ───────────────────────── KPI Pill ───────────────────────── */

const KpiPill = ({
  label,
  value,
  icon,
  tone,
  pending,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "emerald" | "amber" | "destructive" | "primary";
  /** Veri henuz gelmedi. "0" DEGIL "-" gosterilir. */
  pending?: boolean;
}) => {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "destructive"
          ? "text-destructive"
          : tone === "primary"
            ? "text-primary"
            : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      {/* Yuklenirken "0" yazmak "hic kullanici yok" diye okunur — oysa dogru
          cevap "henuz bilmiyoruz". Ayni ayrimi mobilde de yapiyoruz. */}
      <div
        className={cn(
          "mt-1 text-2xl tabular-nums",
          pending ? "text-muted-foreground/40" : toneCls,
        )}
      >
        {pending ? "—" : value}
      </div>
    </div>
  );
};

/* ───────────────────────── Avatar ───────────────────────── */

const Avatar = ({ user }: { user: ProjectUser }) => {
  const hue = user.id
    .split("")
    .reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={cn(
        "flex size-8 items-center justify-center rounded-full font-mono text-xs font-medium ring-1 ring-border",
        user.banned && "ring-destructive/40 opacity-50",
      )}
      style={{
        background: `hsl(${hue} 60% 92%)`,
        color: `hsl(${hue} 55% 32%)`,
      }}
    >
      {initial(user)}
    </div>
  );
};

/* ───────────────────────── User Badges ───────────────────────── */

const UserBadges = ({ user }: { user: ProjectUser }) => (
  <div className="flex flex-wrap gap-1">
    {user.banned && (
      <Badge variant="destructive" className="text-[10px]">
        <Ban className="mr-1 size-2.5" />
        banlı
      </Badge>
    )}
    {user.premium && (
      <Badge className="border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]">
        <Sparkles className="mr-1 size-2.5" />
        premium{user.premium_tier ? ` T${user.premium_tier}` : ""}
      </Badge>
    )}
    {user.email_confirmed_at && !user.banned && (
      <Badge variant="secondary" className="text-[10px]">
        <Mail className="mr-1 size-2.5" />
        onaylı
      </Badge>
    )}
    {user.providers.map((p) => (
      <Badge key={p} variant="outline" className="text-[10px] capitalize">
        {p}
      </Badge>
    ))}
  </div>
);

/* ───────────────────────── Preview Panel (yan) ───────────────────────── */

const PreviewPanel = ({ user }: { user: ProjectUser | null }) => {
  if (!user) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<UserCog className="size-6" />}
            title="Bir kullanıcı seç"
            description="Soldaki listeden bir satıra tıkla - özet, etiketler ve hızlı aksiyonlar burada açılır. Detay sayfası için ➜ ikonunu kullan."
            compact
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar user={user} />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">
              {user.email ?? (
                <span className="text-muted-foreground">(e-posta yok)</span>
              )}
            </CardTitle>
            <code className="block break-all font-mono text-[10px] text-muted-foreground">
              {user.id}
            </code>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <UserBadges user={user} />

        <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-xs">
          <dt className="text-muted-foreground">Kayıt</dt>
          <dd>
            {new Date(user.created_at).toLocaleString("en-US")}{" "}
            <span className="text-muted-foreground">
              ({fmtRelative(user.created_at)})
            </span>
          </dd>

          <dt className="text-muted-foreground">Son giriş</dt>
          <dd>
            {user.last_sign_in_at ? (
              <>
                {new Date(user.last_sign_in_at).toLocaleString("en-US")}{" "}
                <span className="text-muted-foreground">
                  ({fmtRelative(user.last_sign_in_at)})
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">hiç</span>
            )}
          </dd>

          <dt className="text-muted-foreground">E-posta onayı</dt>
          <dd>
            {user.email_confirmed_at
              ? new Date(user.email_confirmed_at).toLocaleDateString("en-US")
              : "-"}
          </dd>

          {(user.country || user.city) && (
            <>
              <dt className="text-muted-foreground">Konum</dt>
              <dd>
                {flag(user.country_code)}{" "}
                {[user.city, user.country].filter(Boolean).join(", ")}
              </dd>
            </>
          )}

          {user.premium && (
            <>
              <dt className="text-muted-foreground">Premium</dt>
              <dd>
                {user.premium_tier ? `Tier ${user.premium_tier}` : "aktif"}
                {user.premium_expires_at
                  ? ` · ${new Date(user.premium_expires_at).toLocaleDateString("en-US")} bitiş`
                  : " · süresiz"}
              </dd>
            </>
          )}

          <dt className="text-muted-foreground">Provider</dt>
          <dd>
            {user.providers.length > 0 ? user.providers.join(", ") : "-"}
          </dd>
        </dl>

        <Button asChild className="w-full" size="sm">
          <Link to={`/users/${user.id}`}>
            <Shield className="size-4" />
            <span className="ml-2">Detay & aksiyonlar</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
