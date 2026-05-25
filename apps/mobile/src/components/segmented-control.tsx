import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
  Animated,
  type LayoutChangeEvent,
} from "react-native";

import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";

type Segment<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  segments: Segment<T>[];
  active: T;
  onChange: (value: T) => void;
};

const PADDING = 3;

// iOS-native styled segmented control — animasyonlu pill, mono uppercase label.
export function SegmentedControl<T extends string>({
  segments,
  active,
  onChange,
}: Props<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = segments.findIndex((s) => s.value === active);
  const translateX = useRef(new Animated.Value(0)).current;

  const segmentWidth =
    containerWidth > 0 ? (containerWidth - PADDING * 2) / segments.length : 0;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: activeIndex * segmentWidth,
      useNativeDriver: true,
      tension: 90,
      friction: 12,
    }).start();
  }, [activeIndex, segmentWidth, translateX]);

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: "row",
        backgroundColor: colors.bgElevated,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: PADDING,
        position: "relative",
      }}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: PADDING,
            bottom: PADDING,
            left: PADDING,
            width: segmentWidth,
            backgroundColor: colors.fgPrimary,
            borderRadius: 9,
            transform: [{ translateX }],
          }}
        />
      ) : null}

      {segments.map((seg) => {
        const isActive = seg.value === active;
        return (
          <Pressable
            key={seg.value}
            onPress={() => {
              if (!isActive) {
                haptic.selection();
                onChange(seg.value);
              }
            }}
            style={{
              flex: 1,
              paddingVertical: 9,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 10,
                letterSpacing: 1.5,
                color: isActive ? colors.bgBase : colors.fgMuted,
              }}
            >
              {seg.label.toUpperCase()}
            </Text>
            {seg.count !== undefined ? (
              <View
                style={{
                  backgroundColor: isActive
                    ? `${colors.bgBase}25`
                    : colors.bgHigher,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 5,
                  minWidth: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 9,
                    color: isActive ? colors.bgBase : colors.fgSecondary,
                  }}
                >
                  {seg.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
