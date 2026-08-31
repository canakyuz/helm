import { useEffect, useMemo, useState } from "react";
import { type CrudFilter, useInvalidate, useList } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { reviewsKeys } from "@helm/queries";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageStatus } from "@/components/ui/page-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { supabaseClient } from "@/providers/supabase-client";
import { useReviewStats } from "@/hooks/use-review-stats";
import { useScope } from "@/context/scope";
import type { Project, Review } from "@/types";
import { ReplyModal } from "./reply-modal";

const PAGE = 25;

const stars = (rating: number | null) => {
  const r = Math.max(0, Math.min(5, rating ?? 0));
  return "★".repeat(r) + "☆".repeat(5 - r);
};

const starColor = (r: number | null) => {
  if (!r) return "text-muted-foreground";
  if (r <= 2) return "text-destructive";
  if (r <= 3) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

export const ReviewsPage = () => {
  const { scope, isAll } = useScope();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  // Yanit gonderildikten sonra liste (pagination: off) bastan cekiliyor;
  // kullanici o sureyi beklemesin diye gonderilen metni yerel olarak ustte
  // gosteriyoruz. Gercek veri gelince developer_response dolu olur ve bu
  // katman kendiliginden devre disi kalir. Space: O(gonderilen yanit sayisi).
  const [pendingReplies, setPendingReplies] = useState<Record<string, string>>(
    {},
  );
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const [replyTarget, setReplyTarget] = useState<Review | null>(null);

  // A) Platform state
  const [platform, setPlatform] = useState<"all" | "appstore" | "playstore">("all");

  // Arama artik sunucuya gidiyor - her tusa bir sorgu atmamak icin geciktir.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Filtrelerin TAMAMI sorguda: PostgREST max_rows = 1000, yani "hepsini cek,
  // tarayicida filtrele" yaklasimi portfoy buyudugunde listeyi sessizce keser.
  const filters: CrudFilter[] = [];
  if (!isAll) {
    filters.push({ field: "project_id", operator: "eq", value: scope });
  }
  if (platform !== "all") {
    filters.push({ field: "source", operator: "eq", value: platform });
  }
  if (ratingFilter !== "all") {
    filters.push({ field: "rating", operator: "eq", value: Number(ratingFilter) });
  }
  if (debouncedQ) {
    filters.push({
      operator: "or",
      value: [
        { field: "title", operator: "contains", value: debouncedQ },
        { field: "body", operator: "contains", value: debouncedQ },
        { field: "author", operator: "contains", value: debouncedQ },
      ],
    });
  }

  const { result, query } = useList<Review>({
    resource: "reviews",
    filters,
    sorters: [{ field: "review_date", order: "desc" }],
    pagination: { currentPage: page + 1, pageSize: PAGE, mode: "server" },
  });
  const reviews = result.data;
  const totalCount = result.total ?? 0;

  const { result: projResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projectName = (id: string) =>
    projResult.data.find((p) => p.id === id)?.name ?? "-";

  // Ozet DB'de toplanir (helm_review_stats). Listeden hesaplanmiyor: liste
  // artik yalnizca gorunen sayfayi tasiyor, ustelik 1000 tavani da var.
  const statsQuery = useReviewStats();
  const stats = statsQuery.data;
  const scoped = stats
    ? platform === "all"
      ? stats.all
      : stats[platform]
    : undefined;

  const avg = scoped?.average ?? 0;
  const ratedCount = scoped?.rated ?? 0;
  const scopedTotal = scoped?.total ?? 0;

  const distribution = useMemo(() => {
    const d = [0, 0, 0, 0, 0]; // 1..5
    if (!scoped) return d;
    for (const star of [1, 2, 3, 4, 5] as const) d[star - 1] = scoped.distribution[star];
    return d;
  }, [scoped]);
  const distMax = Math.max(1, ...distribution);

  const iosAvg = stats?.appstore.average ?? 0;
  const androidAvg = stats?.playstore.average ?? 0;
  const platformTotals = {
    all: stats?.all.total ?? 0,
    appstore: stats?.appstore.total ?? 0,
    playstore: stats?.playstore.total ?? 0,
  };

  const hasFilter =
    platform !== "all" || ratingFilter !== "all" || debouncedQ.length > 0;

  useEffect(() => setPage(0), [debouncedQ, ratingFilter, scope, isAll, platform]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE));

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
      // Ozet Refine'in disinda, kendi query'sinde duruyor - yeni yorumlar
      // gelince onun da tazelenmesi gerekir.
      queryClient.invalidateQueries({ queryKey: reviewsKeys.stats(isAll ? "all" : scope) });
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

      {/* D) 5 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <StatCard
          title="Genel Ortalama"
          value={avg ? `${avg.toFixed(2)} / 5` : "-"}
          icon={<Star />}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="iOS Ortalama"
          value={iosAvg ? `${iosAvg.toFixed(2)}` : "-"}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="Android Ortalama"
          value={androidAvg ? `${androidAvg.toFixed(2)}` : "-"}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="Toplam yorum"
          value={scopedTotal}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="Negatif (1-2★)"
          value={distribution[0] + distribution[1]}
          loading={statsQuery.isLoading}
        />
      </div>

      {/* E) Platform segmented control */}
      <div className="flex gap-1 rounded-md border bg-muted p-1 w-fit">
        {(["all", "appstore", "playstore"] as const).map((p) => (
          <Button
            key={p}
            variant={platform === p ? "default" : "ghost"}
            size="sm"
            onClick={() => setPlatform(p)}
          >
            {p === "all" ? "Tümü" : p === "appstore" ? "iOS" : "Android"}
            <span className="ml-2 text-xs opacity-70">{platformTotals[p]}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Puan dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[5, 4, 3, 2, 1].map((r) => {
            const count = distribution[r - 1];
            const pct = ratedCount > 0 ? (count / ratedCount) * 100 : 0;
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
                <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                  {count} · %{pct.toFixed(1)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* F) Card başlığı "Yorumlar" */}
      <Card>
        <CardHeader>
          <CardTitle>Yorumlar</CardTitle>
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

          {query.isLoading ? (
            <PageStatus tone="loading" label="Yorumlar yükleniyor…" />
          ) : query.isError ? (
            <PageStatus tone="error" label="Yorumlar yüklenemedi - tekrar dene" />
          ) : totalCount === 0 ? (
            <EmptyState
              icon={<MessageSquare className="size-6" />}
              title={hasFilter ? "Filtreye uyan kayıt yok" : "Henüz yorum yok"}
              description={
                hasFilter
                  ? "Filtreyi gevşet veya aramayı değiştir."
                  : "Property → Düzenle → App Store ID / Package ID gir, sonra Ayarlar → Entegrasyonlar → App Store Connect veya Google Play Developer bağla. Cron 30 dakikada bir çeker; hemen istiyorsan Yenile'yi kullan."
              }
              compact
            />
          ) : (
            <>
              <div className="divide-y">
                {reviews.map((r) => (
                  <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={starColor(r.rating)}>{stars(r.rating)}</span>
                        <span className="font-medium">{r.title ?? ""}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {r.source === "appstore" ? "iOS" : "Android"}
                        </Badge>
                        {r.app_version && (
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            v{r.app_version}
                          </Badge>
                        )}
                        {r.territory && (
                          <Badge variant="secondary" className="text-[10px]">
                            {r.territory}
                          </Badge>
                        )}
                        {isAll && (
                          <Badge variant="secondary" className="text-xs">
                            {projectName(r.project_id)}
                          </Badge>
                        )}
                      </div>
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
                    {(r.developer_response ?? pendingReplies[r.id]) ? (
                      <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-sm">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            Yanıt
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setReplyTarget(r)}
                          >
                            Düzenle
                          </Button>
                        </div>
                        <p className="mt-1">
                          {r.developer_response ?? pendingReplies[r.id]}
                        </p>
                        {r.responded_at && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(r.responded_at).toLocaleString("tr-TR")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReplyTarget(r)}
                          disabled={r.source_method === "rss"}
                          title={r.source_method === "rss" ? "RSS yorumlarına yanıt verilemez" : undefined}
                        >
                          Yanıtla
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {page * PAGE + 1}–{Math.min(totalCount, (page + 1) * PAGE)} /{" "}
                  {totalCount}
                  {hasFilter && ` (toplam ${platformTotals.all})`}
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

      <ReplyModal
        review={replyTarget}
        open={replyTarget !== null}
        onOpenChange={(open) => !open && setReplyTarget(null)}
        onReplied={(body) => {
          if (replyTarget) {
            setPendingReplies((prev) => ({ ...prev, [replyTarget.id]: body }));
          }
          invalidate({ resource: "reviews", invalidates: ["list"] });
        }}
      />
    </div>
  );
};
