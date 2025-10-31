import React from 'react';
import { View, useColorScheme } from 'react-native';
import { VictoryArea, VictoryChart, VictoryGroup } from 'victory-native';

type Point = { x: number | string; y: number };

interface LineMiniProps {
  data: Point[];
  height?: number;
}

export default function LineMini({ data, height = 80 }: LineMiniProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const accent = '#007AFF';
  const fill = isDark ? 'rgba(0,122,255,0.2)' : 'rgba(0,122,255,0.15)';

  // Victory performs best with numeric x-values for sparklines
  const mapped = data.map((d, i) => ({ x: i + 1, y: d.y }));

  return (
    <View style={{ height }}>
      <VictoryChart
        height={height}
        padding={{ top: 8, bottom: 8, left: 8, right: 8 }}
        domainPadding={{ x: 2, y: 2 }}
      >
        <VictoryGroup>
          <VictoryArea
            data={mapped}
            interpolation="monotoneX"
            style={{ data: { stroke: accent, fill } }}
          />
        </VictoryGroup>
      </VictoryChart>
    </View>
  );
}


