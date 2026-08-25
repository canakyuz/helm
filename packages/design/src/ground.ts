// Zemin ışığı - ekranın üstünden vuran, aşağı doğru sönen ışık kaynağı.
//
// Dekoratif gradient DEĞİL: odanın aydınlatması. Yüzeyler onu yakalar
// (BentoTile yarı saydam cam, altındaki zeminle birlikte parlar), göz derinlik
// okur. Bütün sayılar ölçümle sabitlendi - hiçbiri gözle seçilmedi.
//
// ─── ÖLÇÜLEN TAVANLAR (dark tema, #0A0A0C zemin) ─────────────────────────────
// Işığın tepesi iki bağımsız kısıt tarafından yukarıdan sınırlanıyor. Bileşik
// tepe alfası arttıkça ikisi de bozulur:
//
//   1) METİN. Ekranın en tepesinde zemine DOĞRUDAN oturan en sönük metin
//      BentoHeader'ın eyebrow'u ve SyncStamp damgası: fg3 = #9E9EA4.
//      Işıksız zeminde 7.42:1. Tepe alfa 0.18'de 4.52:1 - burası WCAG AA
//      (4.5:1) sınırı.                                    → tavan α ≤ 0.18
//
//   2) ZEMİN MERDİVENİ. Kart ile zemin arasındaki ΔL. DİKKAT: `tile` token'ı
//      (#131318) dark temada ekrana HİÇ basılmıyor - BentoTile cam, yüzeyi
//      GlassView/BlurView + rgba(255,255,255,0.09) fill taşıyor. Yani gerçek
//      kart = zemin + %9 beyaz. Işıksız ΔL = .0986. Tepe alfa büyüdükçe
//      zemin karta yaklaşır: 0.16'da ΔL = .0731, 0.17'de .0691 (<.07).
//                                                          → tavan α ≤ 0.16
//
// Bağlayıcı kısıt METİN DEĞİL MERDİVEN: 0.16. Seçilen bileşik tepe 0.12 -
// her iki tavanın da altında pay bırakır (fg3 5.60:1, ΔL .0757). Pay lazım
// çünkü iOS liquid glass malzemesi modellenemeyen ek bir lift ekliyor ve
// aurora blob'ları ışığın altında kendi parlaklıklarını katıyor.
//
// ─── AÇIK TEMADA IŞIK YOK ────────────────────────────────────────────────────
// Sebep matematiksel, zevk değil. Açık temada zemin L = .9570, kart L = 1.0000
// (saf beyaz) - arada TOPLAM .0430 pay var, zaten hedefin (.05) altında.
// Kart tavana dayalı olduğu için ışık onu daha fazla açamaz; sadece zemini
// yukarı iter ve payı YER: α=.04'te ΔL .0430 → .0400, α=.10'da .0397.
// Görünür herhangi bir ışık kartları zemine karıştırır. Bu yüzden `light: null`.

import type { ThemeName } from "./themes";

/** Tek bir ışık kaynağı. Ekranın ÜST KENARININ ÜSTÜNDE durur. */
export type GroundLobe = {
  /** Merkezin yatay konumu - ekran genişliğinin oranı. */
  x: number;
  /** Tepe çarpanı. 1 = tam güç, <1 = yardımcı/dolgu ışık. */
  weight: number;
  /**
   * Yatay sıkıştırma. 1 = daire, <1 = yatayda dar / dikeyde uzun elips.
   *
   * NEDEN VAR: iki lob de daire olduğunda yarıçap (1.52×genişlik) lob
   * aralığından (0.52×genişlik) üç kat büyük kalıyor, loblar tamamen
   * birbirine karışıyor ve alan TAM ORTADA tepe yapıyor - yani kaçınmak
   * istediğimiz "ortalanmış radial vinyet"in ta kendisi (ölçüldü: %50'de
   * .120, iki kenarda .097/.100 - neredeyse düz ve simetrik).
   * Sıkıştırma + ağırlık farkı tepeyi %35'e kaydırır ve sağ kenara doğru
   * sürekli bir düşüş bırakır: ışık tavanın solundan geliyormuş gibi okunur.
   */
  squeezeX: number;
};

export type GroundLight = {
  /** Işık alanının yüksekliği = ekran GENİŞLİĞİNİN bu katı. */
  spanRatio: number;
  /**
   * Lob merkezinin ekranın üst kenarının ÜSTÜNDE kaldığı mesafe
   * (yine genişlik oranı). En parlak kısım kırpılır, ekranda sadece sönüş
   * görünür - kaynağın kendisi kadraj dışındadır.
   */
  riseRatio: number;
  /**
   * TEK LOB tepe opaklığı. Ekrandaki bileşik tepe bundan YÜKSEKTİR
   * (loblar üst üste biner: 1−Π(1−αᵢ)). Yukarıdaki tavanlar bileşik değeri
   * sınırlar; bu sayı ondan geri çözüldü → bileşik tepe 0.120.
   */
  alpha: number;
  /** Işığın rengi. Nötr beyaz: accent kullanıcı seçimli, ışığı ona bağlamak
   *  zemini tema tercihine göre renklendirirdi. */
  tint: string;
  /**
   * 4 duraklı sönüş eğrisi - [yarıçap oranı, tepe çarpanı].
   *
   * NEDEN 4 DURAK: tek duraklı lineer sönüş koni gibi biter, gözün "kenar"
   * gördüğü bir çizgi bırakır. Bu eğri erken yavaş (0→.38 arası hâlâ .68),
   * ortada hızlı, sonda tekrar yavaş söner - fiziksel ışık düşüşünün profili.
   */
  falloff: readonly (readonly [number, number])[];
  /** Işık kaynakları. Merkezden kaydırılmış, farklı güçte. */
  lobes: readonly GroundLobe[];
};

export const ground: Record<ThemeName, GroundLight | null> = {
  dark: {
    // Alan büyüklüğü tepeden daha önemli ve kontrastla HİÇ kısıtlı değil -
    // bedava kazanç. Dar bir alana aynı tepeyi koymak üst kenara yapışmış bir
    // hale üretir; 1.3×genişlik (iPhone 16 Pro'da 523pt, ekranın %60'ı) ışık
    // gibi okunan şeydir.
    spanRatio: 1.3,
    riseRatio: 0.22,
    // 0.089 tek lob → bileşik tepe 0.120 (ölçüldü, bkz. dosya başı).
    alpha: 0.089,
    tint: "#FFFFFF",
    falloff: [
      [0, 1],
      [0.38, 0.68],
      [0.68, 0.3],
      [1, 0],
    ],
    lobes: [
      { x: 0.26, weight: 1, squeezeX: 0.55 },
      { x: 0.78, weight: 0.78, squeezeX: 0.85 },
    ],
  },
  light: null,
};
