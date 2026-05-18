import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  /** Yüzde değişim. null/undefined ise trend satırı "—" gösterir. */
  delta?: number | null;
  deltaLabel?: string;
  loading?: boolean;
}

// Başlık + büyük değer + trend göstergeli istatistik kartı.
export const StatCard = ({
  title,
  value,
  icon,
  delta,
  deltaLabel = "son 7 gün",
  loading,
}: StatCardProps) => {
  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const hasDelta =
    delta !== null && delta !== undefined && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;

  return (
    <Card className="h-full">
      <CardContent>
        <div className="mb-2.5 flex items-center gap-2 text-muted-foreground">
          {icon && <span className="[&_svg]:size-4">{icon}</span>}
          <span className="text-[13px]">{title}</span>
        </div>

        <div className="text-2xl font-semibold tracking-tight">{value}</div>

        {/* Trend satırı her zaman yer kaplar — kartlar aynı boyda kalsın. */}
        <div className="mt-1.5 min-h-5 text-xs">
          {hasDelta ? (
            <>
              <span
                className={cn(
                  "font-medium",
                  positive ? "text-emerald-500" : "text-red-500",
                )}
              >
                {positive ? (
                  <ArrowUp className="inline size-3" />
                ) : (
                  <ArrowDown className="inline size-3" />
                )}{" "}
                {Math.abs(delta as number).toFixed(1)}%
              </span>{" "}
              <span className="text-muted-foreground">{deltaLabel}</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
