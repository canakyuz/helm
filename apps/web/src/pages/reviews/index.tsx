import { useState } from "react";
import { type CrudFilter, useInvalidate, useList } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import type { Review } from "@/types";

const stars = (rating: number | null) => {
  const r = Math.max(0, Math.min(5, rating ?? 0));
  return "★".repeat(r) + "☆".repeat(5 - r);
};

export const ReviewsPage = () => {
  const { scope, isAll } = useScope();
  const invalidate = useInvalidate();
  const [refreshing, setRefreshing] = useState(false);

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

  const rated = reviews.filter((r) => r.rating != null);
  const avg = rated.length
    ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
    : 0;

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Ortalama Puan"
          value={avg ? `${avg.toFixed(2)} / 5` : "—"}
          loading={query.isLoading}
        />
        <StatCard
          title="Toplam Yorum"
          value={reviews.length}
          loading={query.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son Yorumlar (App Store)</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 && !query.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Yorum yok. Proje detayında "Düzenle" → App Store ID gir, sonra
              "Yenile".
            </div>
          ) : (
            <div className="divide-y">
              {reviews.map((r) => (
                <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500">{stars(r.rating)}</span>
                    <span className="font-medium">{r.title ?? ""}</span>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};
