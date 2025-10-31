import React from 'react';
import { View, useColorScheme } from 'react-native';
import { VictoryPie } from 'victory-native';

interface PieDatum {
  x: string;
  y: number;
}

interface PieProps {
  data: PieDatum[];
  height?: number;
}

const paletteLight = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];
const paletteDark = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF'];

export default function Pie({ data, height = 220 }: PieProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? paletteDark : paletteLight;

  return (
    <View style={{ height }}>
      <VictoryPie
        height={height}
        data={data}
        colorScale={colors}
        innerRadius={50}
        padAngle={2}
        labels={({ datum }) => `${datum.x} ${(datum.y / 60).toFixed(1)}h`}
        style={{ labels: { fontSize: 10 } }}
      />
    </View>
  );
}


