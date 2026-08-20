import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BarPoint {
  date: string;
  value: number;
}

interface BarTrendCardProps {
  title: string;
  /** Günlük seri (artan tarih sıralı). */
  data: BarPoint[];
  /** Başlıktaki büyük toplam (formatlanmış). */
  total: string;
  /** % delta; null → gizlenir. */
  delta?: number | null;
  deltaLabel?: string;
  /** Tooltip/eksen değer formatı. */
  format: (v: number) => string;
  className?: string;
}

/** Kravio bar chart tooltip'i: koyu çip, beyaz metin. */
const DarkTip = ({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  format: (v: number) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-md">
      {label} : {format(payload[0].value)}
    </div>
  );
};

/** Kravio "Ticket Volume Trend" karşılığı: açık gri barlar, seçili/son gün
 *  koyu lacivert. Hover önizler, tıklama sabitler (tekrar tıkla → bırak);
 *  ikisi de yoksa son gün vurgulu. Time: O(n) render, n = gün sayısı. */
export const BarTrendCard = ({
  title,
  data,
  total,
  delta,
  deltaLabel = "vs önceki dönem",
  format,
  className,
}: BarTrendCardProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const activeIndex = hovered ?? pinned ?? data.length - 1;

  // Gün etiketi: "08-14" yerine kısa gün adı + gün (Kravio: Sun/Mon/Tue).
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        label: new Date(`${p.date}T00:00:00`).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        }),
      })),
    [data],
  );

  const hasDelta =
    delta !== null && delta !== undefined && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;

  return (
    <Card className={cn("py-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <TrendingUp className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="helm-hero-number text-[2.25rem]">{total}</span>
          {hasDelta && (
            <span className="text-xs">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  positive ? "text-emerald-600" : "text-red-600",
                )}
              >
                {positive ? "+" : ""}
                {(delta as number).toFixed(1)}%
              </span>{" "}
              <span className="text-muted-foreground">{deltaLabel}</span>
            </span>
          )}
        </div>
        {chartData.length === 0 ? (
          <div className="grid h-56 place-items-center text-sm text-muted-foreground">
            Veri yok
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={chartData}
              // Klavye focus katmanı svg'ye tabindex veriyordu; tıklamada
              // global outline-ring çerçevesi çiziliyordu - kapat.
              accessibilityLayer={false}
              margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
              onMouseMove={(s) =>
                setHovered(
                  typeof s?.activeTooltipIndex === "number"
                    ? s.activeTooltipIndex
                    : null,
                )
              }
              onMouseLeave={() => setHovered(null)}
            >
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "rgb(var(--bento-fg3))" }}
                minTickGap={18}
              />
              <YAxis
                orientation="right"
                axisLine={false}
                tickLine={false}
                width={44}
                tick={{ fontSize: 11, fill: "rgb(var(--bento-fg3))" }}
                tickFormatter={(v: number) => format(v)}
              />
              <Tooltip
                cursor={false}
                // Plot kenarında kırpılmasın - tooltip viewBox dışına taşabilir.
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 30, pointerEvents: "none" }}
                offset={14}
                content={<DarkTip format={format} />}
              />
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                className="cursor-pointer"
                onClick={(_, index) =>
                  setPinned((p) => (p === index ? null : index))
                }
              >
                {chartData.map((p, i) => (
                  <Cell
                    key={p.date}
                    fill={
                      i === activeIndex
                        ? "var(--primary)"
                        : // Kart zemininden türetilmiş gri - iki temada da okunur.
                          "color-mix(in srgb, rgb(var(--bento-fg3)) 24%, rgb(var(--bento-tile)))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
