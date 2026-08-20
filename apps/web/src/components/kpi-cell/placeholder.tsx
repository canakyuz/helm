import { Lock } from "lucide-react";
import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { useScope } from "@/context/scope";
import { cn } from "@/lib/utils";

interface KpiPlaceholderProps {
  label: string;
  // Hangi modül kapalıysa bu placeholder gösterilmeli (kullanıcıya bilgi için).
  module: string;
  className?: string;
}

/** Modül kapalıyken KpiCell yerine geçen ghost iskelet.
 *  Aynı boyut, dimmed renkler, "modülü aç" link'i ile property edit'e gider. */
export const KpiPlaceholder = ({ label, module, className }: KpiPlaceholderProps) => {
  const { scope } = useScope();
  const editHref = scope === "all" ? "/" : `/properties/edit/${scope}`;

  return (
    <Card className={cn("overflow-hidden opacity-65", className)}>
      <CardContent className="flex h-full flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          <Lock className="size-3 opacity-60" />
        </div>
        <div className="helm-hero-number text-[clamp(1.5rem,3cqw,2rem)] leading-none text-muted-foreground/40">
          -
        </div>
        <div className="flex min-h-[18px] items-center">
          {scope === "all" ? (
            <span className="text-[10px] text-muted-foreground/70">
              {module} modülü kapalı
            </span>
          ) : (
            <Link
              to={editHref}
              className="text-[10px] text-muted-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
            >
              {module} modülünü aç →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
