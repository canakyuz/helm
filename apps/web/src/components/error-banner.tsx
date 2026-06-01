import { AlertTriangle, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  variant?: "error" | "warning" | "info";
  title?: string;
  children: ReactNode;
  className?: string;
}

const styles = {
  error: {
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: <XCircle className="size-4 shrink-0" />,
  },
  warning: {
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: <AlertTriangle className="size-4 shrink-0" />,
  },
  info: {
    cls: "border-foreground/15 bg-muted/40 text-foreground",
    icon: <Info className="size-4 shrink-0" />,
  },
} as const;

/** Tutarlı uyarı/hata banner'ı.
 *  - error: kırmızı (kritik, action gerekir)
 *  - warning: amber (dikkat, bilgi)
 *  - info: nötr (rehber, hint)
 */
export const ErrorBanner = ({
  variant = "error",
  title,
  children,
  className,
}: ErrorBannerProps) => {
  const s = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        s.cls,
        className,
      )}
    >
      <span className="mt-0.5">{s.icon}</span>
      <div className="flex-1 space-y-1">
        {title && <div className="font-medium">{title}</div>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};
