import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusKind = "ok" | "error" | "warn" | "pending" | "info";

const KIND_CLASSES: Record<StatusKind, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-600/25 dark:text-emerald-400",
  error:
    "bg-red-500/10 text-red-700 ring-1 ring-red-600/25 dark:text-red-400",
  warn: "bg-amber-500/10 text-amber-700 ring-1 ring-amber-600/25 dark:text-amber-400",
  pending: "bg-muted text-muted-foreground ring-1 ring-border",
  info: "bg-sky-500/10 text-sky-700 ring-1 ring-sky-600/25 dark:text-sky-400",
};

interface StatusBadgeProps {
  kind: StatusKind;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Flat status pill - açık tonlu zemin + koyu metin (Kravio dili).
 *  Light'ta 700, dark'ta 400 metin - iki temada da okunur kontrast. */
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
