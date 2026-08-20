import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SyncOrbProps {
  /** Başarılı sync sayısı. */
  okCount: number;
  /** Toplam aktif entegrasyon sayısı. */
  total: number;
  /** Boyut piksel (orb dış çap, default 96). */
  size?: number;
  className?: string;
}

type Health = "ok" | "warn" | "err" | "idle";

const healthOf = (ok: number, total: number): Health => {
  if (total === 0) return "idle";
  const ratio = ok / total;
  if (ratio >= 1) return "ok";
  if (ratio >= 0.7) return "warn";
  return "err";
};

const COLORS: Record<Health, { dot: string; label: string }> = {
  ok: { dot: "bg-emerald-500", label: "Sağlıklı" },
  warn: { dot: "bg-amber-500", label: "Dikkat" },
  err: { dot: "bg-red-500", label: "Hata" },
  idle: { dot: "bg-muted-foreground/50", label: "Bekliyor" },
};

/** Sync sağlık göstergesi - flat dot + ince halka (glow yok, Kravio dili).
 *  okCount/total ratio'ya göre renk değişir. */
export const SyncOrb = ({
  okCount,
  total,
  size = 96,
  className,
}: SyncOrbProps) => {
  const health = useMemo(() => healthOf(okCount, total), [okCount, total]);
  const colors = COLORS[health];

  return (
    <div
      className={cn("flex flex-col items-center justify-center", className)}
      role="status"
      aria-label={`Sync sağlığı: ${colors.label} - ${okCount} / ${total}`}
    >
      <div
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
      >
        {/* İnce dış halka - sabit, border rengi */}
        <span
          aria-hidden
          className="absolute inset-3 rounded-full border border-border"
        />
        {/* İç dot - sabit, flat */}
        <span aria-hidden className={cn("relative size-3 rounded-full", colors.dot)} />
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums">
        {okCount}
        <span className="text-muted-foreground">/{total}</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Sync · {colors.label}
      </div>
    </div>
  );
};
