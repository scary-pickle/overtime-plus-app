import React from 'react';
import { View, useColorScheme } from 'react-native';
let VictoryAxis: any, VictoryChart: any, VictoryLine: any;
try {
  const v = require('victory-native');
  VictoryAxis = v.VictoryAxis;
  VictoryChart = v.VictoryChart;
  VictoryLine = v.VictoryLine;
} catch (e) {
  VictoryAxis = null;
  VictoryChart = null;
  VictoryLine = null;
}

type Point = { x: string | number; y: number };

interface LineProps {
  data: Point[];
  height?: number;
  xTickCount?: number;
}

export default function Line({ data, height = 220, xTickCount = 6 }: LineProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const axisColor = isDark ? '#aaa' : '#666';
  const lineColor = '#007AFF';

  if (!VictoryChart || !VictoryLine || !VictoryAxis) {
    return <View style={{ height, borderRadius: 12, backgroundColor: isDark ? '#223' : '#e8f0fe' }} />;
  }

  return (
    <View style={{ height }}>
      <VictoryChart height={height} padding={{ top: 16, bottom: 40, left: 48, right: 16 }}>
        <VictoryAxis style={{ axis: { stroke: axisColor }, tickLabels: { fill: axisColor, fontSize: 10 } }} tickCount={xTickCount} />
        <VictoryAxis dependentAxis tickFormat={(t: number) => `${Math.round(t / 60)}h`} style={{ axis: { stroke: axisColor }, tickLabels: { fill: axisColor, fontSize: 10 } }} />
        <VictoryLine data={data} interpolation="monotoneX" style={{ data: { stroke: lineColor, strokeWidth: 2 } }} />
      </VictoryChart>
    </View>
  );
}


