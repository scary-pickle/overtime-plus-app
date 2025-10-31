import React from 'react';
import { View, useColorScheme } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme } from 'victory-native';

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

  return (
    <View style={{ height }}>
      <VictoryChart height={height} theme={VictoryTheme.material} padding={{ top: 16, bottom: 40, left: 48, right: 16 }}>
        <VictoryAxis
          style={{ axis: { stroke: axisColor }, tickLabels: { fill: axisColor, fontSize: 10 } }}
          tickCount={xTickCount}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(t) => `${Math.round(t / 60)}h`}
          style={{ axis: { stroke: axisColor }, tickLabels: { fill: axisColor, fontSize: 10 } }}
        />
        <VictoryLine data={data} interpolation="monotoneX" style={{ data: { stroke: lineColor, strokeWidth: 2 } }} />
      </VictoryChart>
    </View>
  );
}


