import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SparkPoint {
  date: string;
  value: number;
}

/** Mini area sparkline - KPI kartı sağ altı (Kravio referansı).
 *  Time: O(n) path üretimi, n = nokta sayısı. */
const Sparkline = ({
  data,
  positive,
}: {
  data: SparkPoint[];
  positive: boolean;
}) => {
  if (data.length < 2) return null;
  const W = 96;
  const H = 40;
  const values = data.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const dx = W / (data.length - 1);
  const pts = data
    .map((p, i) => {
      const x = i * dx;
      const y = H - 4 - ((p.value - min) / span) * (H - 8);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${pts} L${W},${H} L0,${H} Z`;
  const color = positive ? "rgb(var(--bento-pos))" : "rgb(var(--bento-neg))";
  const gradId = `kpi-spark-${positive ? "pos" : "neg"}`;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      className="h-10 w-24 shrink-0"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={pts}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface KpiCardProps {
  /** Kart başlığı (sol üst). */
  title: string;
  /** Sağ üst ikon çipi. */
  icon?: ReactNode;
  /** Büyük hero sayı (formatlanmış). */
  value: string;
  /** % delta; null → satır gizlenir. */
  delta?: number | null;
  /** Delta karşılaştırma etiketi ("vs dün", "vs geçen hafta"). */
  deltaLabel?: string;
  /** Sparkline serisi (son ~14 nokta yeterli). */
  spark?: SparkPoint[];
  loading?: boolean;
  className?: string;
}

/** Kravio KPI kartı: başlık + ikon üstte, büyük sayı + delta solda,
 *  renkli mini sparkline sağda. */
export const KpiCard = ({
  title,
  icon,
  value,
  delta,
  deltaLabel = "vs geçen hafta",
  spark,
  loading,
  className,
}: KpiCardProps) => {
  if (loading) {
    return (
      <Card className={cn("py-0", className)}>
        <CardContent className="flex flex-col gap-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const hasDelta =
    delta !== null && delta !== undefined && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;

  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {title}
          </span>
          {icon && (
            <span className="text-muted-foreground/70 [&_svg]:size-4">
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="helm-hero-number text-[2rem] text-foreground">
              {value}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1 text-xs">
              {hasDelta ? (
                <>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      positive
                        ? "text-[rgb(var(--bento-pos))]"
                        : "text-destructive",
                    )}
                  >
                    {positive ? "+" : ""}
                    {(delta as number).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">{deltaLabel}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{deltaLabel}</span>
              )}
            </div>
          </div>
          {spark && <Sparkline data={spark} positive={positive} />}
        </div>
      </CardContent>
    </Card>
  );
};
