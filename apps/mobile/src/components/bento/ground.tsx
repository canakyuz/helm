import { useMemo, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Blur,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Paint,
  RadialGradient,
  Rect,
  vec,
} from "@shopify/react-native-skia";
import { ground as groundLight } from "@helm/design";

import { useTheme } from "~/theme/use-theme";

/** "#0A0A0C" + 0.8 → "rgba(10,10,12,0.8)". Skia hex+alpha kabul etmiyor. */
function rgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Ekran kökü - zemin + ışık + içerik.
 *
 * NEDEN BİLEŞEN, NEDEN `backgroundColor: theme.bg` DEĞİL: ekranın zemini artık
 * tek bir renk değil, ÜÇ KATMAN. Düz renk yazan her ekran bu katmanları
 * kaybeder; daha kötüsü, ışığın üstüne opak sayfa rengi basan her yer ekranın
 * tepesinde sert bir dikiş bırakır. Tek kap = dikiş yok, düzeltmesi tek dosya.
 *
 * Katman sırası (alttan üste) ve HER BİRİNİN NEDENİ:
 *
 *   1. zemin rengi      theme.bg. Her şeyin tabanı.
 *   2. aurora           kısık renkli blob'lar. Cam, arkasındaki şeyi
 *                       bulanıklaştırarak var olur - düz zeminde GlassView'in
 *                       kıracağı hiçbir şey kalmaz.
 *   3. dikey vinyet     aurora'yı uçlarda söndürür. ORTAYI AÇIK BIRAKIR.
 *   4. ZEMİN IŞIĞI      üstten vuran ışık. Reçete: @helm/design → ground.
 *
 * KATMAN 4 EN ÜSTTE OLMAK ZORUNDA. Vinyet (katman 3) tepeye `rgba(bg, 0.55)`
 * basıyor - yani sayfa renginin %55'ini opak biçimde. Işık ondan ÖNCE çizilirse
 * tepesinin yarısından fazlası oracıkta yenir; ölçülen tepe 0.120 yerine ~0.054
 * olur ve ışık görünmez. Sıralamayı değiştirme.
 *
 * Time: O(1) çizim düğümü (2 lob + 4 blob + 1 vinyet). Space: O(1).
 */
export function ScreenGround({ children }: { children: ReactNode }) {
  const { name, theme, glass } = useTheme();
  const { width, height } = useWindowDimensions();
  const [minGlow, maxGlow] = glass.auroraOpacity;

  // Blob'lar EKRANIN ORTASINA yayılır, tepeye değil: tepede opak accent hero
  // oturuyor ve aurora'yı kapatıyor. Işık, camın OLDUĞU yerde olmalı.
  const blobs = useMemo(
    () => [
      { cx: width * 0.08, cy: height * 0.34, r: 240, color: theme.accent, glow: maxGlow },
      { cx: width * 1.02, cy: height * 0.46, r: 210, color: theme.violet, glow: maxGlow },
      { cx: width * -0.05, cy: height * 0.72, r: 200, color: theme.blue, glow: minGlow },
      { cx: width * 1.05, cy: height * 0.9, r: 170, color: theme.amber, glow: minGlow },
    ],
    [width, height, theme.accent, theme.violet, theme.blue, theme.amber, minGlow, maxGlow],
  );

  // Işık geometrisi reçeteden TÜRETİLİR - burada hiçbir sayı yok.
  // Yarıçap = (span + rise) × genişlik, çünkü merkez üst kenarın rise kadar
  // üstünde; ekranda kalan dikey erim tam olarak span × genişlik olsun istiyoruz.
  const lamp = useMemo(() => {
    const recipe = groundLight[name];
    if (recipe == null) return null;
    const radius = (recipe.spanRatio + recipe.riseRatio) * width;
    const cy = -recipe.riseRatio * width;
    const positions = recipe.falloff.map(([p]) => p);
    return {
      band: Math.min(height, recipe.spanRatio * width),
      radius,
      cy,
      positions,
      lobes: recipe.lobes.map((lobe) => ({
        cx: lobe.x * width,
        squeezeX: lobe.squeezeX,
        colors: recipe.falloff.map(([, k]) =>
          rgba(recipe.tint, recipe.alpha * lobe.weight * k),
        ),
      })),
    };
  }, [name, width, height]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group layer={<Paint><Blur blur={50} /></Paint>}>
          {blobs.map((b, i) => (
            <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} opacity={b.glow}>
              <RadialGradient
                c={vec(b.cx, b.cy)}
                r={b.r}
                colors={[`${b.color}66`, `${b.color}00`]}
              />
            </Circle>
          ))}
        </Group>

        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={[rgba(theme.bg, 0.55), rgba(theme.bg, 0), rgba(theme.bg, 0.45)]}
            positions={[0, 0.5, 1]}
          />
        </Rect>

        {/* Zemin ışığı - vinyetin ÜSTÜNDE. Bkz. dosya başındaki sıra uyarısı.
            Her lob ayrı Rect: üst üste binmeleri source-over ile bileşilir,
            yani bileşik alfa = 1−Π(1−αᵢ). Reçetedeki `alpha` bu formülden
            geri çözülmüş tek-lob değeridir.
            squeezeX yatay sıkıştırma: origin lob merkezinde scaleX uygulanınca
            gradyan uzayında x mesafesi 1/squeezeX ile büyür - daire elipse
            döner, iki lob birbirine karışıp ortada tek tepe yapmaz. */}
        {lamp?.lobes.map((lobe, i) => (
          <Rect key={i} x={0} y={0} width={width} height={lamp.band}>
            <RadialGradient
              c={vec(lobe.cx, lamp.cy)}
              r={lamp.radius}
              colors={lobe.colors}
              positions={lamp.positions}
              origin={vec(lobe.cx, lamp.cy)}
              transform={[{ scaleX: lobe.squeezeX }]}
            />
          </Rect>
        ))}
      </Canvas>

      {children}
    </View>
  );
}
