import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHelmTheme } from "@/theme/ThemeProvider";

export interface TrendPoint {
  date: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  /** Çizgi rengi. Verilmezse temanın birincil grafik rengi kullanılır. */
  color?: string;
  height?: number;
  /** Y ekseni ve tooltip değer biçimlendirici. */
  format?: (value: number) => string;
}

// recharts tabanlı hafif zaman serisi grafiği. Izgara/eksen renkleri temadan.
export const TrendChart = ({
  data,
  color,
  height = 240,
  format,
}: TrendChartProps) => {
  const { theme } = useHelmTheme();
  const lineColor = color ?? theme.chart.users;

  if (data.length === 0) {
    return (
      <div
        className="grid place-items-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Veri yok
      </div>
    );
  }

  const idSuffix = lineColor.replace(/[^a-z0-9]/gi, "");
  const gradientId = `helm-grad-${idSuffix}`;
  const glowId = `helm-glow-${idSuffix}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.45} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.04} />
          </linearGradient>
          {/* Liquid Glass — line üzerinde soft glow (referans Airlinesim). */}
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={theme.chart.grid}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          stroke={theme.chart.axis}
          tick={{ fontSize: 11, fill: theme.chart.axis }}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={28}
        />
        <YAxis
          stroke={theme.chart.axis}
          tick={{ fontSize: 11, fill: theme.chart.axis }}
          width={52}
          tickFormatter={(v: number) => (format ? format(v) : String(v))}
        />
        <Tooltip
          formatter={(v) => [
            format ? format(Number(v ?? 0)) : String(v ?? ""),
            "",
          ]}
          labelFormatter={(d) => String(d)}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          filter={`url(#${glowId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
