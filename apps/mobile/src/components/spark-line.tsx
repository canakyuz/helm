import { useMemo } from "react";
import { View } from "react-native";
import { Canvas, Path, Skia, LinearGradient, vec } from "@shopify/react-native-skia";

import type { SparkPoint } from "~/hooks/use-cockpit-kpis";

type Props = {
  data: SparkPoint[];
  width: number;
  height: number;
  color?: string;
};

export function SparkLine({ data, width, height, color = "#22c55e" }: Props) {
  const { linePath, areaPath } = useMemo(() => {
    if (data.length < 2) return { linePath: null, areaPath: null };

    const values = data.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    const points = data.map((p, i) => ({
      x: i * stepX,
      y: height - ((p.value - min) / range) * height * 0.9 - height * 0.05,
    }));

    const line = Skia.Path.Make();
    const area = Skia.Path.Make();
    const first = points[0]!;
    line.moveTo(first.x, first.y);
    area.moveTo(first.x, height);
    area.lineTo(first.x, first.y);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const cx = (prev.x + curr.x) / 2;
      line.cubicTo(cx, prev.y, cx, curr.y, curr.x, curr.y);
      area.cubicTo(cx, prev.y, cx, curr.y, curr.x, curr.y);
    }

    area.lineTo(width, height);
    area.close();

    return { linePath: line, areaPath: area };
  }, [data, width, height]);

  if (!linePath || !areaPath) {
    return <View style={{ width, height }} />;
  }

  return (
    <Canvas style={{ width, height }}>
      <Path path={areaPath} style="fill">
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[`${color}55`, `${color}00`]}
        />
      </Path>
      <Path path={linePath} style="stroke" strokeWidth={2} color={color} />
    </Canvas>
  );
}
