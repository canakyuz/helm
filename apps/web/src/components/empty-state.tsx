import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Sol üstte icon (lucide veya custom). */
  icon?: ReactNode;
  /** Ana başlık - kısa, ne eksik. */
  title: string;
  /** Açıklama - neden eksik + ne yapılmalı. */
  description?: ReactNode;
  /** Aksiyon butonu (opsiyonel) - `<Button>` veya `<Link>`. */
  action?: ReactNode;
  /** İkincil aksiyon (link gibi, daha az vurgu). */
  secondaryAction?: ReactNode;
  className?: string;
  /** Compact = daha az padding (Card içinde dar alanda). */
  compact?: boolean;
}

/** Tutarlı "boş durum" görünümü. Her sayfada aynı görsel dil:
 *  ikon (40% opaque) → başlık (semibold) → açıklama (muted) → aksiyon.
 *
 *  Kullanım örneği:
 *    <EmptyState
 *      icon={<Users className="size-6" />}
 *      title="Henüz kullanıcı yok"
 *      description="Empire Inc Supabase Auth'ta kullanıcı oluşturulduğunda burada görünür."
 *      action={<Button>Senkronize et</Button>}
 *    />
 */
export const EmptyState = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-6" : "py-10",
      className,
    )}
  >
    {icon && (
      <div className="mb-3 text-muted-foreground opacity-50">{icon}</div>
    )}
    <div className="text-sm font-medium">{title}</div>
    {description && (
      <div className="mt-1 max-w-md text-xs text-muted-foreground">
        {description}
      </div>
    )}
    {(action || secondaryAction) && (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {action}
        {secondaryAction}
      </div>
    )}
  </div>
);
