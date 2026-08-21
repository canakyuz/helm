import { useMemo } from "react";
import { useList, type CrudFilter } from "@refinedev/core";
import { Building2, CreditCard, Crown, Pause, TrendingDown, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { TrendChart } from "@/components/trend-chart";
import { useScope } from "@/context/scope";
import { compact, deltaPct, latest, series } from "@/lib/metrics";
import type { Metric } from "@/types";

// Ürün funnel sağlığı - Empire Inc'in analytics_daily snapshot'ından gelen
// anlık durum metrikleri (source='supabase'). PostHog event funnel'ından AYRI;
// "oyun keyifli mi / loop tutuyor mu" sorusunu cevaplar.
//
// "kind=pct" metrikler 0-100 yüzde, "count" metrikler ham sayı.
// "higherIsBetter=false" olanlarda (≤1 işletme, level-1, pause) artış KÖTÜ -
// StatCard delta'sı yükselişi yeşil gösterdiği için bu metriklerde delta gizlenir
// (yanıltıcı renk olmasın); trend yerine aşağıdaki grafikten okunur.
const CARDS = [
  { metric: "players_total", title: "Toplam oyuncu", kind: "count", icon: Users, higherIsBetter: true },
  { metric: "paying_users", title: "Ödeme yapan", kind: "count", icon: CreditCard, higherIsBetter: true },
  { metric: "pct_ever_prestiged", title: "Prestij yapan", kind: "pct", icon: Crown, higherIsBetter: true },
  { metric: "pct_le1_business", title: "≤1 işletme", kind: "pct", icon: Building2, higherIsBetter: false },
  { metric: "pct_level1", title: "Level 1'de takılan", kind: "pct", icon: TrendingDown, higherIsBetter: false },
  { metric: "pct_paused", title: "Vergi/Pause Kilidi", kind: "pct", icon: Pause, higherIsBetter: false },
] as const;

const ALL_NAMES = CARDS.map((c) => c.metric);

export const FunnelHealth = () => {
  const { scope, isAll } = useScope();

  // Metrik filtresi vardi ama TARIH filtresi yoktu: sorgu her calistiginda tum
  // gecmisi istiyordu. Bugun 480 satir, yani sorun gorunmuyor - ama satir sayisi
  // her gun buyuyor ve PostgREST 1.000'de sessizce kesiyor. O gun geldiginde
  // kartlar hata vermez, sadece yanlis sayi gosterir; bulunmasi en zor ariza tipi.
  // 90 gun bu kartlar (son deger + delta + trend) icin fazlasiyla yeterli.
  const since = useMemo(
    () => new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
    [],
  );

  const filters: CrudFilter[] = [
    { field: "metric", operator: "in", value: ALL_NAMES },
    { field: "date", operator: "gte", value: since },
  ];
  if (!isAll) filters.push({ field: "project_id", operator: "eq", value: scope });

  const { result, query } = useList<Metric>({
    resource: "metrics",
    filters,
    sorters: [{ field: "date", order: "desc" }],
    pagination: { mode: "off" },
  });
  const metrics = result.data;
  const loading = query.isLoading;

  // Çoklu proje (isAll) seçiliyken aynı metrik birden çok projeden gelir; helper'lar
  // metric adına göre tarihsel seri kurduğu için "All" görünümünde toplama gerekir.
  // Tek proje scope'unda zaten tek seri - yaygın kullanım bu, KISS.
  const fmtValue = (kind: "count" | "pct", v: number) =>
    kind === "pct" ? `%${v.toFixed(1)}` : compact(v);

  const le1Series = useMemo(() => series(metrics, "pct_le1_business"), [metrics]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Huni sağlığı</h2>
        <span className="text-xs text-muted-foreground">günlük anlık görüntü</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <StatCard
            key={c.metric}
            title={c.title}
            value={fmtValue(c.kind, latest(metrics, c.metric))}
            icon={<c.icon />}
            // Düşmesi-iyi metriklerde delta gizli - yanıltıcı renk olmasın.
            delta={c.higherIsBetter ? deltaPct(series(metrics, c.metric)) : undefined}
            loading={loading}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">≤1 operation ratio · lower is better</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={le1Series} format={(v) => `%${v.toFixed(0)}`} />
        </CardContent>
      </Card>
    </section>
  );
};
