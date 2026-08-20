import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/components/trend-chart";

interface HeroGhostProps {
  /** Üst etiket (örn: BUGÜN ŞIMDIYE KADAR · REKLAM + MAĞAZA). */
  label: string;
  /** Büyük hero rakamı (formatlanmış string). */
  value: string;
  /** Sub satır (opsiyonel) - hero rakamın hemen altında doğal akışta render edilir. */
  sub?: React.ReactNode;
  /** Arkada ghost olarak çizilecek son N gün serisi. */
  spark?: TrendPoint[];
  /** Spark çizgi rengi (default primary). */
  sparkColor?: string;
  className?: string;
}

/** Hero number + arkada ghost sparkline.
 *  Layout: label / hero rakam / (opsiyonel) sub. Doğal akış - sub her zaman görünür.
 *  Sparkline arkada absolute, içeriğe karışmaz. */
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
    const area = `${pts.join(" ")} L${W},${H} L0,${H} Z`;
    const line = pts.join(" ");
    return { area, line };
  }, [spark]);

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      {/* Ghost sparkline - arka plan, içeriğe karışmaz */}
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
      {/* Üst - label */}
      <div className="relative text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {/* Orta - hero sayı */}
      <div className="helm-hero-number relative text-[clamp(2rem,4.4cqw,2.75rem)] leading-none">
        {value}
      </div>
      {/* Alt - sub doğal akışta hemen altta */}
      {sub && <div className="relative text-xs">{sub}</div>}
    </div>
  );
};
