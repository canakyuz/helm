import { useEffect, useMemo, useState } from "react";
import { type CrudFilter, useInvalidate, useList } from "@refinedev/core";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";
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
import { StatCard } from "@/components/stat-card";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import type { Project, Review } from "@/types";

const PAGE = 25;

const stars = (rating: number | null) => {
  const r = Math.max(0, Math.min(5, rating ?? 0));
  return "★".repeat(r) + "☆".repeat(5 - r);
};

const starColor = (r: number | null) => {
  if (!r) return "text-muted-foreground";
  if (r <= 2) return "text-destructive";
  if (r <= 3) return "text-amber-500";
  return "text-emerald-500";
};

export const ReviewsPage = () => {
  const { scope, isAll } = useScope();
  const invalidate = useInvalidate();
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const filters: CrudFilter[] = [];
  if (!isAll) {
    filters.push({ field: "project_id", operator: "eq", value: scope });
  }
  const { result, query } = useList<Review>({
    resource: "reviews",
    filters,
    sorters: [{ field: "review_date", order: "desc" }],
    pagination: { mode: "off" },
  });
  const reviews = result.data;

  const { result: projResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projectName = (id: string) =>
    projResult.data.find((p) => p.id === id)?.name ?? "—";

  const rated = reviews.filter((r) => r.rating != null);
  const avg = rated.length
    ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
    : 0;

  const distribution = useMemo(() => {
    const d = [0, 0, 0, 0, 0]; // 1..5
    for (const r of rated) {
      const idx = Math.min(5, Math.max(1, r.rating ?? 0)) - 1;
      d[idx]++;
    }
    return d;
  }, [rated]);
  const distMax = Math.max(1, ...distribution);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return reviews.filter((r) => {
      if (ratingFilter !== "all" && r.rating !== Number(ratingFilter)) {
        return false;
      }
      if (needle) {
        const hay =
          (r.title ?? "").toLowerCase() +
          " " +
          (r.body ?? "").toLowerCase() +
          " " +
          (r.author ?? "").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [reviews, ratingFilter, q]);

  useEffect(() => setPage(0), [q, ratingFilter, scope, isAll]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageData = filtered.slice(page * PAGE, (page + 1) * PAGE);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-reviews",
        { body: {} },
      );
      if (error) throw error;
      toast.success("Yorumlar güncellendi", {
        description: `${data?.reviews ?? 0} yorum çekildi.`,
      });
      invalidate({ resource: "reviews", invalidates: ["list"] });
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
        <h1 className="text-2xl font-semibold tracking-tight">Yorumlar</h1>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw
            className={refreshing ? "size-4 animate-spin" : "size-4"}
          />
          Yenile
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Ortalama Puan"
          value={avg ? `${avg.toFixed(2)} / 5` : "—"}
          icon={<Star />}
          loading={query.isLoading}
        />
        <StatCard
          title="Toplam Yorum"
          value={reviews.length}
          loading={query.isLoading}
        />
        <StatCard
          title="Negatif (1-2★)"
          value={distribution[0] + distribution[1]}
          loading={query.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Puan Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[5, 4, 3, 2, 1].map((r) => {
            const count = distribution[r - 1];
            const pct = rated.length > 0 ? (count / rated.length) * 100 : 0;
            const widthPct = (count / distMax) * 100;
            return (
              <div key={r} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-12 font-mono text-xs ${starColor(r)}`}
                >
                  {r} ★
                </span>
                <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={`absolute inset-y-0 left-0 ${
                      r <= 2
                        ? "bg-destructive/40"
                        : r === 3
                          ? "bg-amber-500/40"
                          : "bg-emerald-500/40"
                    }`}
                    style={{ width: `${Math.max(widthPct, 1)}%` }}
                  />
                </div>
                <span className="w-24 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {count} · %{pct.toFixed(1)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yorumlar (App Store)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Başlık, içerik, yazar ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm puanlar</SelectItem>
                <SelectItem value="5">5 ★</SelectItem>
                <SelectItem value="4">4 ★</SelectItem>
                <SelectItem value="3">3 ★</SelectItem>
                <SelectItem value="2">2 ★</SelectItem>
                <SelectItem value="1">1 ★</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 && !query.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {reviews.length === 0
                ? "Yorum yok. Proje detayında \"Düzenle\" → App Store ID gir, sonra \"Yenile\"."
                : "Filtreye uyan yorum yok"}
            </div>
          ) : (
            <>
              <div className="divide-y">
                {pageData.map((r) => (
                  <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={starColor(r.rating)}>
                          {stars(r.rating)}
                        </span>
                        <span className="font-medium">{r.title ?? ""}</span>
                      </div>
                      {isAll && (
                        <Badge variant="secondary" className="text-xs">
                          {projectName(r.project_id)}
                        </Badge>
                      )}
                    </div>
                    {r.body && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.body}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.author ?? "anonim"} ·{" "}
                      {r.review_date
                        ? new Date(r.review_date).toLocaleDateString("tr-TR")
                        : ""}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {page * PAGE + 1}–
                  {Math.min(filtered.length, (page + 1) * PAGE)} /{" "}
                  {filtered.length}
                  {reviews.length !== filtered.length &&
                    ` (toplam ${reviews.length})`}
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
    </div>
  );
};
