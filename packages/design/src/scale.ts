// Ölçek - bento tasarımının kendi değerleri, isimlendirilmiş.
//
// Neden sayısal merdiven (4·8·12·16) değil: bento'nun oranları 10px gap ve
// 18px tile padding üzerine kurulu. 4pt'ye yuvarlamak (10→12, 18→16) tasarımın
// ritmini bozar. İsimli ölçek "keyfi px" yasağını korur - her değerin bir
// kullanım yeri var, gelişigüzel sayı yazılamaz.

/** Boşluk. Yeni sayı ekleme; bir kullanım buraya sığmıyorsa isim ekle. */
export const space = {
  /**
   * Etiket–değer arası, rozet dikey padding. Satır içi en küçük nefes.
   *
   * NEDEN SONRADAN EKLENDİ: `mt-xs` / `mb-xs` ekranlarda ZATEN yazılıydı ama
   * ölçekte karşılığı yoktu - Tailwind'in varsayılan spacing'inde de `xs`/`sm`
   * anahtarı yok, dolayısıyla o sınıflar hiç üretilmiyor, sessizce SIFIR
   * boşluk veriyordu. Hero'daki delta rozetinin yatay padding'i bu yüzden yoktu.
   */
  xs: 6,
  /** Rozet yatay padding, yan yana ikon butonları arası. */
  sm: 8,
  /** Ekran yatay padding. */
  screenX: 16,
  /** Tile'lar arası dikey/yatay boşluk. */
  tileGap: 10,
  /** Standart tile içi padding (liste/section tile). */
  tilePad: 18,
  /** Hero tile içi padding. */
  tilePadLg: 20,
  /** Küçük stat tile içi padding. */
  tilePadSm: 16,
  /** Tile içi kutu (tile2) padding. */
  boxPad: 14,
  /** Liste satırı dikey padding. */
  rowY: 12,
  /** Başlık şeridi dikey padding. */
  headerY: 14,
  /** Alt sekme çubuğu - üst / alt (home indicator payı). */
  tabBarTop: 12,
  tabBarBottom: 26,
} as const;

/** Köşe yarıçapları. */
export const radius = {
  /** Ana bento tile. */
  tile: 22,
  /** Tile içi kutu (tile2), segment kabı. */
  inner: 16,
  /** Alan, çip, sekme pili. */
  field: 14,
  /** Proje monogram karesi. */
  icon: 13,
  /** Küçük aksiyon / header ikon butonu. */
  btn: 12,
  /** Logo karesi (52px). */
  logo: 18,
  /** Yatay oran rail'i. */
  rail: 4,
  /** Bar grafik çubuğu. */
  bar: 3,
  /** Pill / toggle. */
  pill: 999,
} as const;

/** Tip skalası. Yarım punto yok - mockup'taki tek 11.5px değeri 12'ye çekildi. */
export const type = {
  /** Eyebrow - 10px mono, BÜYÜK HARF, geniş tracking. */
  eyebrow: 10,
  /** Meta, zaman damgası, satır altı açıklama. */
  meta: 12,
  /** Mono değer, ikincil rakam. */
  body: 13,
  /** Liste satırı başlığı. */
  row: 14,
  /** Section / kart başlığı. */
  emph: 15,
  /** Ekran başlığı. */
  title: 19,
  /** tile2 içi rakam (retention, payout). */
  statSm: 22,
  /** 3'lü stat tile rakamı. Mockup 26 ve 28 arasında gidip geliyordu; 28'de birleşti. */
  stat: 28,
  /** Hero rakamı. Mockup 44/46/50 kullanıyordu - tek boyut + adjustsFontSizeToFit,
   *  uzun rakamda taşma kendiliğinden çözülür (design.md §3 kuralı). */
  hero: 48,
} as const;

// Tracking em cinsinden. React Native'de `letterSpacing` MUTLAK nokta değeri
// ister, em değil - bu yüzden doğrudan kullanılamaz, track() ile çevrilir.
export const tracking = {
  hero: -0.045,
  tightest: -0.04,
  tighter: -0.03,
  tight: -0.02,
  /** Eyebrow - tile içi. */
  wide: 0.16,
  /** Eyebrow - ekran başlığı üstü. */
  wider: 0.18,
} as const;

/** em → React Native letterSpacing (nokta). `track(type.emph, tracking.tight)` */
export const track = (fontSize: number, em: number): number =>
  Math.round(fontSize * em * 100) / 100;

/** Satır yükseklikleri - sadece çok satırlı metin için. Tek satırda RN'e bırak. */
export const leading = {
  meta: 18,
  row: 21,
  hero: 48,
} as const;
