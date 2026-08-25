import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Fallback harfi bu isimden türetilir. */
  name: string;
  logoUrl?: string | null;
  /** Kare kabuğun boyut/köşe sınıfları. Varsayılan: size-8 rounded-lg. */
  className?: string;
  /** Logo yokken çizilecek içerik. Verilmezse ismin ilk harfi. */
  fallback?: ReactNode;
}

const initial = (name: string): string => name.trim()[0]?.toUpperCase() ?? "?";

/**
 * Marka kimliği karesi: logo varsa görsel, yoksa harf/ikon fallback.
 * Sidebar logosu, kapsam seçici ve marka ayarları aynı kabuğu paylaşır.
 */
export const BrandLogo = ({ name, logoUrl, className, fallback }: BrandLogoProps) => {
  const shell = cn(
    "flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg",
    className,
  );

  if (logoUrl) {
    return (
      <span className={cn(shell, "border border-border bg-card")}>
        <img
          src={logoUrl}
          alt={`${name} logosu`}
          className="size-full object-cover"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span className={cn(shell, "bg-muted text-foreground")}>
      {fallback ?? <span className="text-xs font-semibold">{initial(name)}</span>}
    </span>
  );
};
