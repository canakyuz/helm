// Format helper'ları @helm/domain'e taşındı (web/mobile tek kaynak).
// Bu dosya geriye-uyumluluk için re-export; çağrı yerleri ~/lib/format'ı kullanmaya devam eder.
export * from "@helm/domain";

import { relativeTimeParts } from "@helm/domain";
import { tr } from "~/lib/i18n";

/**
 * Goreli zaman — dile duyarli surum.
 *
 * NEDEN BURADA EZILIYOR: `@helm/domain` surumu hazir Turkce dizgi donuyor ve on
 * ekranda ("8 dk önce") Ingilizce arayuzde Turkce kaliyordu. Parcalari kendimiz
 * birlestirip ceviri tablosundan geciriyoruz; on cagri yerinin hicbiri
 * degismiyor cunku isim ayni ve bu re-export'tan sonra tanimlaniyor.
 */
export function formatRelativeTime(iso: string | Date): string {
  const p = relativeTimeParts(iso);
  if (p.kind === "now") return tr(p.past ? "şimdi" : "az sonra");
  return tr(p.past ? `{n} ${p.unit} önce` : `{n} ${p.unit} sonra`, { n: p.value });
}
