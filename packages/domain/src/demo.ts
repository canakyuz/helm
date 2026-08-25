// Ekran görüntüsü modu - arayüzü gerçek portföyü ifşa etmeden göstermek.
//
// İki ayrı maske, iki ayrı gerekçe:
//   1. AD MASKESİ  - proje/marka adlarını takma adla değiştirir.
//   2. SAYAÇ ÇARPANI - kullanıcı sayaçlarını `revenueMultiplier` ile ölçekler,
//      böylece gelir ve kullanıcı tarafı AYNI oranda büyür.
//
// Hepsi saf fonksiyon ve `@helm/domain`'de: mobil bugün, web yarın aynı
// kaynağı kullansın diye (uygulama başına ayrı bir takma ad tablosu, iki
// platformda AYNI projeye FARKLI ad verirdi).

// ─── AD MASKESİ ──────────────────────────────────────────────────────────────

/**
 * Takma adlar iki havuzun BİRLEŞİMİ, tek havuzdan seçim değil.
 *
 * NEDEN: tek havuzdan hash ile seçimde çakışma olasılığı acımasız. 40 adet
 * tek kelimelik havuz ve 10 proje ile iki projenin aynı adı alma olasılığı
 * ~%68 (doğum günü problemi) - ekranda iki farklı proje "Nimbus" görünürdü.
 * 32×24 = 768 birleşim ile aynı olasılık ~%6'ya iner. Birleşim gerçek ürün
 * adları gibi de okunur (Sunbeam, Ironclad, Northgate), çünkü gerçek ürün
 * adlarının çoğu zaten bu yapıda.
 */
const PREFIX = [
  "Sun", "Night", "Iron", "Blue", "Storm", "North", "Ember", "Quick",
  "Silver", "Copper", "Cedar", "Vast", "Bright", "Stone", "Wild", "True",
  "Amber", "Frost", "Golden", "Hollow", "Lark", "Moss", "Onyx", "Pine",
  "Quill", "River", "Slate", "Tide", "Umber", "Vale", "Wren", "Zephyr",
] as const;

const SUFFIX = [
  "beam", "fall", "clad", "bird", "wave", "path", "forge", "drift",
  "peak", "gate", "hold", "lark", "vale", "reach", "spire", "haven",
  "field", "ridge", "brook", "watch", "crest", "harbor", "grove", "point",
] as const;

/** FNV-1a 32-bit. Time: O(m). Space: O(1). */
function fnv1a(input: string, seed: number): number {
  let hash = 0x811c9dc5 ^ seed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime çarpımı, taşmayı Math.imul ile kontrol altında tutar.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Aynı girdi HER ZAMAN aynı takma adı verir.
 *
 * NEDEN DETERMİNİST: rastgele olsaydı proje seçici "Sunbeam", altındaki liste
 * "Ironclad" derdi - aynı projeyi gösteren iki bileşen farklı ad yazardı ve
 * ekran görüntüsü kendi içinde tutarsız çıkardı. Oturumlar arasında da sabit
 * kalması gerekiyor: iki günde çekilen iki görselde aynı proje aynı adla
 * görünmeli.
 */
function alias(name: string, seed: number): string {
  const h = fnv1a(name, seed);
  // İki bağımsız dilim: alt 16 bit önek, üst 16 bit sonek. Tek sayıdan iki
  // indeks türetmek ikisini korele ederdi.
  const prefix = PREFIX[(h & 0xffff) % PREFIX.length]!;
  const suffix = SUFFIX[((h >>> 16) & 0xffff) % SUFFIX.length]!;
  return prefix + suffix;
}

/** Proje / uygulama adı. */
export function aliasProject(name: string): string {
  return alias(name, 0);
}

/** Marka adı. Farklı tohum: bir marka ile bir proje aynı adı almasın. */
export function aliasBrand(name: string): string {
  return alias(name, 0x9e3779b9);
}

/** `null` korunur - "ad yok" bir bilgi, uydurulmaz. */
export function maskProject(name: string | null, on: boolean): string | null {
  return on && name != null && name !== "" ? aliasProject(name) : name;
}

export function maskBrand(name: string | null, on: boolean): string | null {
  return on && name != null && name !== "" ? aliasBrand(name) : name;
}

// ─── SAYAÇ ÇARPANI ───────────────────────────────────────────────────────────

/**
 * Çarpanla ölçeklenebilir SAYAÇ metrikleri.
 *
 * Bu küme bilerek DAR. Bir metrik buraya ancak "kaç tane" sorusunun cevabıysa
 * girer. Girmeyenler ve nedenleri:
 *   · para metrikleri (`MONEY_METRICS`) - çarpan onlara zaten FORMAT katmanında
 *     uygulanıyor (use-format-currency). Burada da ölçeklersek ÇİFT çarpar.
 *   · oran/yüzde (crash_free_sessions, retention, *_rate, *_pct) - %99.5'i
 *     10 ile çarpmak %995 üretir, anlamsız.
 *   · süre (avg_session_sec) - oturumların 10 kat uzadığını söylemek yalan
 *     ve gerçekçi de durmaz.
 *   · fps ölçümleri (p50/p05/worst) - fiziksel tavanı olan bir birim.
 */
export const COUNT_METRICS: ReadonlySet<string> = new Set([
  "dau",
  "mau",
  "wau",
  "total_users",
  "new_users",
  "active_subs",
  "app_downloads",
  "installs",
  "sessions",
]);

export function isCountMetric(metric: string): boolean {
  return COUNT_METRICS.has(metric);
}

/**
 * Sayaç ölçekle. `null` korunur: `null` = ölçüm yok, `0` = ölçüldü ve sıfır -
 * bu ayrım @helm/api boyunca kasten taşınıyor, burada katlamayalım.
 *
 * Tam sayıya yuvarlanır; "1.240,5 kullanıcı" diye bir şey yok.
 */
export function scaleCount(value: null, multiplier: number): null;
export function scaleCount(value: number, multiplier: number): number;
export function scaleCount(value: number | null, multiplier: number): number | null;
export function scaleCount(value: number | null, multiplier: number): number | null {
  if (value == null || multiplier === 1) return value;
  return Math.round(value * multiplier);
}
