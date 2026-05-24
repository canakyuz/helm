import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";
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

type SortField = "created_at" | "last_sign_in_at" | "email";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("tr-TR") : "—";

export const UsersPage = () => {
  const { scope, isAll } = useScope();
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (isAll) {
      setUsers([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(0);
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? users.filter((u) => (u.email ?? "").toLowerCase().includes(needle))
      : users;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [users, q, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  // Sıralama değişince ilk sayfaya dön
  useEffect(() => setPage(0), [q, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ArrowUpAZ className="ml-1 inline size-3" />
    ) : (
      <ArrowDownAZ className="ml-1 inline size-3" />
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Kullanıcılar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Proje kullanıcıları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAll ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Kullanıcıları görmek için sidebar'dan bir proje seç.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="E-posta ara…"
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
                  aria-label="Sıralama yönü"
                >
                  {sortDir === "asc" ? "Artan" : "Azalan"}
                </Button>
              </div>

              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : error ? (
                <div className="py-8 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {q ? "Arama sonucu yok" : "Kullanıcı bulunamadı"}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort("email")}
                        >
                          E-posta {sortIcon("email")}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort("created_at")}
                        >
                          Kayıt {sortIcon("created_at")}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort("last_sign_in_at")}
                        >
                          Son giriş {sortIcon("last_sign_in_at")}
                        </TableHead>
                        <TableHead className="w-16 text-right">
                          Detay
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageData.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            {u.email ?? (
                              <span className="text-muted-foreground">
                                <span className="text-xs">(e-posta yok)</span>{" "}
                                <code className="font-mono text-[10px]">
                                  {u.id.slice(0, 8)}…
                                </code>
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {fmt(u.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {fmt(u.last_sign_in_at)}
                          </TableCell>
                          <TableCell className="text-right">
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
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {pageStart}–{pageEnd} / {filtered.length}
                      {users.length !== filtered.length &&
                        ` (toplam ${users.length})`}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
