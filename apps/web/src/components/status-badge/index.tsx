import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusKind = "ok" | "error" | "warn" | "pending" | "info";

const KIND_CLASSES: Record<StatusKind, string> = {
  ok: "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30 shadow-[0_0_12px_-2px_rgb(16,185,129/0.5)]",
  error:
    "bg-red-500/15 text-red-500 ring-1 ring-red-500/30 shadow-[0_0_12px_-2px_rgb(239,68,68/0.5)]",
  warn: "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30 shadow-[0_0_12px_-2px_rgb(245,158,11/0.45)]",
  pending:
    "bg-muted text-muted-foreground ring-1 ring-foreground/10",
  info: "bg-sky-500/15 text-sky-500 ring-1 ring-sky-500/30 shadow-[0_0_12px_-2px_rgb(14,165,233/0.5)]",
};

interface StatusBadgeProps {
  kind: StatusKind;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Glass status pill - emerald/red/amber/sky tonu + glow shadow.
 *  MarineX referansı (Delayed/On Schedule/At Berth/En Route). */
export const StatusBadge = ({
  kind,
  children,
  icon,
  className,
}: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
      KIND_CLASSES[kind],
      className,
    )}
  >
    {icon && <span className="[&_svg]:size-3">{icon}</span>}
    {children}
  </span>
);
