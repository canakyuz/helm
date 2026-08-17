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

const COLORS: Record<Health, { dot: string; ring: string; label: string }> = {
  ok: { dot: "#10b981", ring: "rgba(16,185,129,0.5)", label: "Healthy" },
  warn: { dot: "#f59e0b", ring: "rgba(245,158,11,0.5)", label: "Dikkat" },
  err: { dot: "#ef4444", ring: "rgba(239,68,68,0.5)", label: "Errors" },
  idle: {
    dot: "var(--muted-foreground)",
    ring: "rgba(120,120,130,0.3)",
    label: "Waiting",
  },
};

/** Sync sağlık orb'u — nabız atan dot + halka.
 *  okCount/total ratio'ya göre renk değişir.
 *  CSS-only animasyon (sync-pulse keyframe glass.css'te).
 *  Helm cockpit ZONE A son cell. */
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
      aria-label={`Sync health: ${colors.label} — ${okCount} / ${total}`}
    >
      <div
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
      >
        {/* Dış halka — pulse */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-[sync-pulse_1.5s_ease-out_infinite]"
          style={{
            background: `radial-gradient(circle, ${colors.ring} 0%, transparent 70%)`,
          }}
        />
        {/* İç dot — sabit */}
        <span
          aria-hidden
          className="relative size-3 rounded-full"
          style={{
            background: colors.dot,
            boxShadow: `0 0 12px ${colors.dot}, 0 0 24px ${colors.dot}80`,
          }}
        />
      </div>
      <div className="mt-1 font-mono text-base font-semibold tabular-nums">
        {okCount}
        <span className="text-muted-foreground">/{total}</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Sync · {colors.label}
      </div>
    </div>
  );
};
