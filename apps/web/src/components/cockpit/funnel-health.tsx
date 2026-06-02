import { useMemo } from "react";
import { useList, type CrudFilter } from "@refinedev/core";
import { Building2, CreditCard, Crown, Pause, TrendingDown, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { TrendChart } from "@/components/trend-chart";
import { useScope } from "@/context/scope";
import { compact, deltaPct, latest, series } from "@/lib/metrics";
import type { Metric } from "@/types";

// Ürün funnel sağlığı — Empire Inc'in analytics_daily snapshot'ından gelen
// anlık durum metrikleri (source='supabase'). PostHog event funnel'ından AYRI;
// "oyun keyifli mi / loop tutuyor mu" sorusunu cevaplar.
//
// "kind=pct" metrikler 0-100 yüzde, "count" metrikler ham sayı.
// "higherIsBetter=false" olanlarda (≤1 işletme, level-1, pause) artış KÖTÜ —
// StatCard delta'sı yükselişi yeşil gösterdiği için bu metriklerde delta gizlenir
// (yanıltıcı renk olmasın); trend yerine aşağıdaki grafikten okunur.
const CARDS = [
  { metric: "players_total", title: "Toplam Oyuncu", kind: "count", icon: Users, higherIsBetter: true },
  { metric: "paying_users", title: "Ödeyen Kullanıcı", kind: "count", icon: CreditCard, higherIsBetter: true },
  { metric: "pct_ever_prestiged", title: "Prestij Yapan", kind: "pct", icon: Crown, higherIsBetter: true },
  { metric: "pct_le1_business", title: "≤1 İşletme", kind: "pct", icon: Building2, higherIsBetter: false },
  { metric: "pct_level1", title: "Level-1'de Takılı", kind: "pct", icon: TrendingDown, higherIsBetter: false },
  { metric: "pct_paused", title: "Vergi/Pause Kilidi", kind: "pct", icon: Pause, higherIsBetter: false },
] as const;

const ALL_NAMES = CARDS.map((c) => c.metric);

export const FunnelHealth = () => {
  const { scope, isAll } = useScope();

  const filters: CrudFilter[] = [{ field: "metric", operator: "in", value: ALL_NAMES }];
  if (!isAll) filters.push({ field: "project_id", operator: "eq", value: scope });

  const { result, query } = useList<Metric>({
    resource: "metrics",
    filters,
    pagination: { mode: "off" },
  });
  const metrics = result.data;
  const loading = query.isLoading;

  // Çoklu proje (isAll) seçiliyken aynı metrik birden çok projeden gelir; helper'lar
  // metric adına göre tarihsel seri kurduğu için "Tümü" görünümünde toplama gerekir.
  // Tek proje scope'unda zaten tek seri — yaygın kullanım bu, KISS.
  const fmtValue = (kind: "count" | "pct", v: number) =>
    kind === "pct" ? `%${v.toFixed(1)}` : compact(v);

  const le1Series = useMemo(() => series(metrics, "pct_le1_business"), [metrics]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Funnel Sağlığı</h2>
        <span className="text-xs text-muted-foreground">günlük snapshot</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <StatCard
            key={c.metric}
            title={c.title}
            value={fmtValue(c.kind, latest(metrics, c.metric))}
            icon={<c.icon />}
            // Düşmesi-iyi metriklerde delta gizli — yanıltıcı renk olmasın.
            delta={c.higherIsBetter ? deltaPct(series(metrics, c.metric)) : undefined}
            loading={loading}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">≤1 işletme oranı · düşmesi iyi</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={le1Series} format={(v) => `%${v.toFixed(0)}`} />
        </CardContent>
      </Card>
    </section>
  );
};
