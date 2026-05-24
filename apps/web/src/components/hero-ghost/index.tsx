import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/components/trend-chart";

interface HeroGhostProps {
  /** Üst etiket (örn: BUGÜN ŞIMDIYE KADAR · REKLAM + MAĞAZA). */
  label: string;
  /** Büyük hero rakamı (formatlanmış string). */
  value: string;
  /** Sub satır (opsiyonel). */
  sub?: React.ReactNode;
  /** Arkada ghost olarak çizilecek son N gün serisi. */
  spark?: TrendPoint[];
  /** Spark çizgi rengi (default primary). */
  sparkColor?: string;
  className?: string;
}

/** Hero number + arkada ghost sparkline.
 *  Helm-özgü detay: rakam ön planda, son 30g trend hafif silüet.
 *  ZONE A sol-üst cell için. */
export const HeroGhost = ({
  label,
  value,
  sub,
  spark,
  sparkColor = "var(--primary)",
  className,
}: HeroGhostProps) => {
  const path = useMemo(() => {
    if (!spark || spark.length < 2) return null;
    const W = 100;
    const H = 30;
    const values = spark.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const dx = W / (spark.length - 1);
    const pts = spark.map((p, i) => {
      const x = i * dx;
      const y = H - ((p.value - min) / span) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    });
    // Alan için altta zemin
    const area = `${pts.join(" ")} L${W},${H} L0,${H} Z`;
    const line = pts.join(" ");
    return { area, line };
  }, [spark]);

  return (
    <div className={cn("relative flex h-full flex-col gap-1.5", className)}>
      {/* Ghost sparkline — daha belirgin (opacity .35) → hayalet değil "atmosfer". */}
      {path && (
        <svg
          aria-hidden
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full opacity-[0.35]"
        >
          <defs>
            <linearGradient id="hero-ghost-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sparkColor} stopOpacity={0.7} />
              <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={path.area} fill="url(#hero-ghost-grad)" />
          <path
            d={path.line}
            stroke={sparkColor}
            strokeWidth={1.5}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {/* Üst — label + hero number (KpiCell label ile AYNI tipografi) */}
      <div className="relative flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
      </div>
      {/* Orta — hero sayı (KpiCell ile aynı clamp, 1.6x büyük) */}
      <div className="helm-hero-number relative text-[clamp(2.25rem,4.8cqw,3rem)] leading-none">
        {value}
      </div>
      {/* Alt — sub (kartın en altına). Dashboard çoğunlukla SubStatGrid geçiyor;
       *  text size override edilebilir. */}
      {sub && (
        <div className="relative mt-auto pt-2 text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
};
