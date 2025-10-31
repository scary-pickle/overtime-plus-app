import React from 'react';
import { View, useColorScheme } from 'react-native';
let VictoryArea: any, VictoryChart: any, VictoryGroup: any;
try {
  const v = require('victory-native');
  VictoryArea = v.VictoryArea;
  VictoryChart = v.VictoryChart;
  VictoryGroup = v.VictoryGroup;
} catch (e) {
  VictoryArea = null;
  VictoryChart = null;
  VictoryGroup = null;
}

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

  if (!VictoryChart || !VictoryArea || !VictoryGroup) {
    return <View style={{ height, borderRadius: 8, backgroundColor: isDark ? '#223' : '#e8f0fe' }} />;
  }

  return (
    <View style={{ height }}>
      <VictoryChart height={height} padding={{ top: 8, bottom: 8, left: 8, right: 8 }} domainPadding={{ x: 2, y: 2 }}>
        <VictoryGroup>
          <VictoryArea data={mapped} interpolation="monotoneX" style={{ data: { stroke: accent, fill } }} />
        </VictoryGroup>
      </VictoryChart>
    </View>
  );
}


