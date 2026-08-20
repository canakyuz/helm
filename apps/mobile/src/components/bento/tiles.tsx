import { Text, View } from "react-native";
import { space } from "@helm/design";

import { BentoTile } from "./tile";
import { Rise } from "./rise";

/**
 * Hero rakamının stili.
 *
 * NEDEN PAYLASILIYOR: üç ekranda ayrı ayrı tanımlıydı ve punto/tracking değerleri
 * çoktan birbirinden ayrışmaya başlamıştı (48/46/44). Hero her ekranda aynı
 * ağırlıkta okunmalı; boyut farkı bilgi taşımıyor.
 */
export const HERO_NUMBER = {
  marginTop: 12,
  fontFamily: "Geist-600",
  fontSize: 46,
  lineHeight: 48,
  letterSpacing: -2,
} as const;

/** Küçük istatistik kutusu - etiket üstte, rakam altta. */
export function MiniTile({
  index,
  replayKey,
  label,
  value,
  sub,
}: {
  index: number;
  replayKey: number;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <Rise index={index} replayKey={replayKey} style={{ flex: 1 }}>
      <BentoTile padding={space.tilePadSm}>
        <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
          {label}
        </Text>
        <Text
          className="mt-sm font-semibold text-stat tracking-tightest text-fg"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {sub}
      </BentoTile>
    </Rise>
  );
}

/** Boş durum satırı - mono, büyük harf, sönük. */
export function Empty({ label }: { label: string }) {
  return (
    <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
      {label}
    </Text>
  );
}

/** İki değerli satır - sol etiket, sağ değer. */
export function InfoRow({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  // Bolucu `border-line` - tema-duyarli tek token. Elle yazilmis
  // rgba(128,128,128,0.18) hem acik temada yanlis tarafa dusuyor hem de
  // olculdugunde cam yuzeyde daha DUSUK kontrast veriyordu (1.24:1 / 1.33:1).
  return (
    <View
      className={`flex-row items-center justify-between py-rowY${
        divider === true ? " border-t border-line" : ""
      }`}
    >
      <Text className="mr-rowY flex-1 font-medium text-row text-fg" numberOfLines={1}>
        {label}
      </Text>
      <Text className="font-mono-semibold text-body text-fg2">{value}</Text>
    </View>
  );
}
