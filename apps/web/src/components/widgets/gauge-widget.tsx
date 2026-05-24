import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface GaugeWidgetProps {
  /** 0-100 arası yüzde değeri. */
  value: number;
  /** Üst etiket — örn "Sync Health". */
  label?: string;
  /** Değerin yanına gelen birim — örn "%", " mph". */
  unit?: string;
  /** Gauge boyutu (px). Default 140. */
  size?: number;
  /** Eşik renkleri: değer hangisinin altındaysa o renk. */
  thresholds?: { value: number; color: string }[];
  className?: string;
}

const DEFAULT_THRESHOLDS: { value: number; color: string }[] = [
  { value: 50, color: "var(--destructive)" },
  { value: 80, color: "#f59e0b" },
  { value: 100, color: "var(--primary)" },
];

/** Yarım daire gauge — Haulix Speedometer referansı.
 *  SVG arc + ibre rotation. Pure CSS, framer-motion bağımlılığı yok. */
export const GaugeWidget = ({
  value,
  label,
  unit = "%",
  size = 140,
  thresholds = DEFAULT_THRESHOLDS,
  className,
}: GaugeWidgetProps) => {
  const clamped = Math.max(0, Math.min(100, value));

  // Eşik tabanlı renk — value <= threshold.value olanlardan ilki.
  const color = useMemo(() => {
    for (const t of thresholds) {
      if (clamped <= t.value) return t.color;
    }
    return thresholds[thresholds.length - 1]?.color ?? "var(--primary)";
  }, [clamped, thresholds]);

  // Yarım daire arc: yarıçap = size/2 - 12 (stroke için boşluk).
  // Çevre = π × r; doluluk = (clamped / 100) × çevre.
  const r = size / 2 - 12;
  const c = Math.PI * r;
  const dash = (clamped / 100) * c;

  // İbre açısı: 0 = -90°, 100 = 90° (yarım daire). Rotation pivot: merkez.
  const angle = -90 + (clamped / 100) * 180;

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      style={{ width: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size / 2 + 12}`}
        width={size}
        height={size / 2 + 12}
        className="overflow-visible"
      >
        {/* Arka plan arc (yarım daire) */}
        <path
          d={`M 6 ${size / 2} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Doluluk arc */}
        <path
          d={`M 6 ${size / 2} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - dash}
          style={{
            transition:
              "stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1), stroke 300ms",
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
        {/* İbre */}
        <g
          style={{
            transformOrigin: `${size / 2}px ${size / 2}px`,
            transform: `rotate(${angle}deg)`,
            transition: "transform 600ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <line
            x1={size / 2}
            y1={size / 2}
            x2={size / 2}
            y2={20}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={size / 2} cy={size / 2} r={6} fill={color} />
        </g>
      </svg>
      <div className="-mt-3 text-center">
        <div className="font-mono text-2xl font-semibold tabular-nums">
          {clamped.toFixed(0)}
          <span className="text-base text-muted-foreground">{unit}</span>
        </div>
        {label && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        )}
      </div>
    </div>
  );
};
