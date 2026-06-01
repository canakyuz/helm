import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export { KpiPlaceholder } from "./placeholder";

interface KpiCellProps {
  /** Üst label (uppercase 10px). */
  label: string;
  /** Büyük hero sayı (formatlanmış string). */
  value: string | number;
  /** % delta (varsa pill); 0 da geçerli. null/undefined → hint gösterir. */
  delta?: number | null;
  deltaLabel?: string;
  /** delta yoksa alt satıra yazılan kısa açıklama. */
  hint?: string;
  /** Sol-alt icon (opsiyonel — provider rozeti gibi). */
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

/** Helm Cockpit KPI cell — tüm ZONE A hücreleri AYNI iskelet.
 *  Top: label · Center: hero number · Bottom: delta pill VEYA hint.
 *  Bottom satırı min-height ile sabit → hücreler eş yükseklikli. */
export const KpiCell = ({
  label,
  value,
  delta,
  deltaLabel = "7g",
  hint,
  icon,
  loading,
  className,
}: KpiCellProps) => {
  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="flex h-full flex-col justify-between p-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  const hasDelta =
    delta !== null && delta !== undefined && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex h-full flex-col gap-1.5 p-3">
        {/* Üst — label + opsiyonel icon */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          {icon && <span className="opacity-60 [&_svg]:size-3">{icon}</span>}
        </div>
        {/* Orta — hero sayı (label hemen altında, sıkı) */}
        <div className="helm-hero-number text-[clamp(1.5rem,3cqw,2rem)] leading-none">
          {value}
        </div>
        {/* Alt — delta pill VEYA hint metni (sayının hemen altında) */}
        <div className="flex min-h-[18px] items-center">
          {hasDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums",
                positive
                  ? "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30"
                  : "bg-red-500/15 text-red-500 ring-1 ring-red-500/30",
              )}
            >
              {positive ? "↑" : "↓"} {Math.abs(delta as number).toFixed(1)}%{" "}
              {deltaLabel}
            </span>
          ) : hint ? (
            <span className="text-[10px] text-muted-foreground">{hint}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
