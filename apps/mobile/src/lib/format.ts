import { relativeTimeParts } from "@helm/domain";
import { tr } from "~/lib/i18n";

/**
 * Bicimleyicilerin mobil giris noktasi.
 *
 * NEDEN `export *` DEGIL: bu dosya `@helm/domain`'i yeniden disari veriyor AMA
 * `formatRelativeTime`'i kendi dile duyarli surumuyle degistiriyor. Yildiz
 * export ile birlikte ayni adi tanimlamak, hangisinin kazandigini okuyana
 * gorunmez kiliyor (ESLint `import/export` da bunu hata sayiyor). Acik liste
 * uzun degil ve neyin nereden geldigini tek bakista gosteriyor.
 */
export {
  FLAT_DELTA_EPSILON,
  formatClock,
  formatCurrency,
  formatCurrencyCompact,
  formatDelta,
  formatInteger,
  formatPercent,
  formatRatio,
  isFlatDelta,
  relativeTimeParts,
  type RelativeTimeParts,
} from "@helm/domain";

/**
 * Goreli zaman — dile duyarli surum.
 *
 * NEDEN DOMAIN SURUMU KULLANILMIYOR: `formatRelativeTimeTR` hazir Turkce dizgi
 * donuyor ("8 dk önce") ve on ekranda Ingilizce arayuzde Turkce kaliyordu.
 * Parcalari kendimiz birlestirip ceviri tablosundan geciriyoruz.
 */
export function formatRelativeTime(iso: string | Date): string {
  const p = relativeTimeParts(iso);
  if (p.kind === "now") return tr(p.past ? "şimdi" : "az sonra");
  return tr(p.past ? `{n} ${p.unit} önce` : `{n} ${p.unit} sonra`, { n: p.value });
}
