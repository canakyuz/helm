import { AlertTriangle, Inbox, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type PageStatusTone = "loading" | "error" | "empty"

const TONE_ICON: Record<PageStatusTone, typeof Loader2> = {
  loading: Loader2,
  error: AlertTriangle,
  empty: Inbox,
}

interface PageStatusProps {
  tone: PageStatusTone
  label: string
  className?: string
}

/** Mobile'daki ScreenStatus'un web karşılığı - her sayfada aynı loading/error/empty dili. */
export function PageStatus({ tone, label, className }: PageStatusProps) {
  const Icon = TONE_ICON[tone]

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "grid min-h-[200px] place-items-center gap-2 py-10 text-center text-muted-foreground",
        className
      )}
    >
      <Icon
        className={cn(
          "size-5",
          tone === "loading" && "animate-spin",
          tone === "error" && "text-destructive"
        )}
      />
      <p className="text-xs">{label}</p>
    </div>
  )
}
