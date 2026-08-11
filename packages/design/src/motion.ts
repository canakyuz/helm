// Hareket — tasarımın 7 CSS keyframe'inin karşılığı.
//
// Tasarım CSS animasyonlarıyla yazılmıştı; mobilde Reanimated worklet'leri
// kullanılır (design.md §8: "CSS yok"). Süreler birebir kopyalanmadı, iki
// gerekçeyle düzeltildi:
//
// 1) UI girişi 300ms altında kalmalı. Mockup'ın 460ms `rise`'ı bir tile için
//    ağır; 260ms'e indi. Grafik animasyonları (grow/rail/ring/count) UZUN
//    KALDI — onlar UI değil, verinin kendini çizmesi; süre bilgi taşıyor.
// 2) `rail` mockup'ta width büyütüyordu → layout tetikler. scaleX + sol
//    anchor'a çevrildi (sadece transform/opacity animasyonu).

/** Güçlü ease-out. Reanimated: Easing.bezier(...EASE_OUT). */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Ekranda yer değiştiren/morph olan öğeler. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const duration = {
  /** Tile girişi — opacity 0→1 + translateY 14→0. */
  rise: 260,
  /** Giriş ekranı blokları; tek seferlik, biraz daha yayvan olabilir. */
  riseLg: 320,
  /** Bar çubuğu — scaleY 0.04→1, origin bottom. */
  grow: 620,
  /** Yatay oran — scaleX 0→1, origin left. */
  rail: 760,
  /** Ring gauge — Skia arc sweep. */
  ring: 900,
  /** Sayaç — 0'dan hedefe. */
  count: 900,
  /** Canlı nokta — sonsuz. */
  pulse: 1800,
  /** Sync ikonu — sonsuz, linear. */
  spin: 900,
  /** Basma geri bildirimi. */
  press: 120,
  /** Buton basma (scale). */
  pressBtn: 140,
} as const;

export const stagger = {
  /** Tile'lar arası giriş gecikmesi. 30–80ms aralığında kal. */
  tile: 40,
  /** Bar çubukları arası. */
  bar: 34,
  /** Rail satırları arası. */
  rail: 80,
} as const;

export const press = {
  /** Satır / tile basma — opaklık. */
  opacity: 0.85,
  /** Buton basma — ölçek. scale(0) asla; 0.95–0.98 aralığı. */
  scale: 0.97,
} as const;

// Sayaç ve grafiklerin NE ZAMAN yeniden oynayacağı.
//
// Mockup her sekme değişiminde play() çağırıyordu (demo davranışı). 5 sekmeli
// bir cockpit'te sekme değişimi günde onlarca kez olur — o sıklıkta animasyon
// bilgi değil gecikme taşır. Taze veri geldiğinde ise animasyon gerçekten
// "bu rakam değişti" diyor.
export type ReplayTrigger = "mount" | "refresh" | "tabChange";

export const replayOn: Record<ReplayTrigger, boolean> = {
  /** İlk mount — tam stagger + sayaç. */
  mount: true,
  /** Pull-to-refresh / sync — sayaç + grafikler tekrar. */
  refresh: true,
  /** Sekme değişimi — animasyon yok, değerler yerinde. */
  tabChange: false,
};

/**
 * Azaltılmış hareket. "Sıfır animasyon" DEĞİL: kavramaya yardım eden
 * opaklık/renk geçişleri kalır, yer değiştirme ve ölçek kalkar.
 */
export const reduced = {
  /** translateY / scaleY / scaleX uygulanmaz. */
  motionScale: 0,
  /** Fade süresi korunur (kısaltılmış). */
  fade: 160,
  /** Sayaç anında son değerde başlar. */
  count: 0,
} as const;
