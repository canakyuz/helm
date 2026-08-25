import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Kullanici goruntu adi. identity.name cogu zaman e-posta oluyor; ham
 *  "ad@sirket.com" yerine "Ad" goster. Ad soyad geldiyse ilk adi alir. */
export function displayName(raw?: string | null): string {
  const value = raw?.trim();
  if (!value) return "Kaptan";
  const local = value.includes("@") ? value.split("@")[0] : value;
  const first = local.split(/[.\s_-]+/).filter(Boolean)[0] ?? local;
  // Rakam kuyrugunu at ("canakyuz23" -> "canakyuz").
  const clean = first.replace(/\d+$/, "") || first;
  return clean.charAt(0).toLocaleUpperCase("tr-TR") + clean.slice(1);
}
