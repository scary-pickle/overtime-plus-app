import React from 'react';
import { View, Text, useColorScheme, StyleSheet } from 'react-native';
import Svg, { Path, Line, G, Text as SvgText } from 'react-native-svg';

type Point = { x: string | number; y: number };

interface LineProps {
  data: Point[];
  height?: number;
  xTickCount?: number;
}

export default function Line({ data, height = 220, xTickCount = 6 }: LineProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!data || data.length === 0) {
    return <View style={{ height, borderRadius: 12, backgroundColor: isDark ? '#223' : '#e8f0fe' }} />;
  }

  const axisColor = isDark ? '#aaa' : '#666';
  const lineColor = '#007AFF';
  const textColor = isDark ? '#fff' : '#333';

  const padding = { top: 16, bottom: 40, left: 48, right: 16 };
  const innerWidth = 300 - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Get min/max for scaling
  const values = data.map((d) => d.y);
  const minY = Math.min(...values, 0);
  const maxY = Math.max(...values, 1);

  // Map data to SVG coordinates
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * innerWidth;
    const y = padding.top + innerHeight - ((d.y - minY) / (maxY - minY || 1)) * innerHeight;
    return { x, y, value: d.y, label: String(d.x) };
  });

  // Create path for line
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Generate Y-axis ticks
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    const value = minY + ((maxY - minY) * i) / (yTickCount - 1);
    const y = padding.top + innerHeight - ((value - minY) / (maxY - minY || 1)) * innerHeight;
    return { value, y };
  });

  // Generate X-axis ticks
  const xTicks = [];
  const step = Math.max(1, Math.floor(data.length / xTickCount));
  for (let i = 0; i < data.length; i += step) {
    xTicks.push({ index: i, x: points[i].x, label: points[i].label });
  }
  if (xTicks[xTicks.length - 1].index !== data.length - 1) {
    xTicks.push({ index: data.length - 1, x: points[points.length - 1].x, label: points[points.length - 1].label });
  }

  return (
    <View style={{ height }}>
      <Svg width={300} height={height} style={{ backgroundColor: 'transparent' }}>
        {/* Y-axis line */}
        <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerHeight} stroke={axisColor} strokeWidth="1" />
        
        {/* Y-axis ticks and labels */}
        {yTicks.map((tick, i) => (
          <G key={`y-${i}`}>
            <Line x1={padding.left} y1={tick.y} x2={padding.left - 4} y2={tick.y} stroke={axisColor} strokeWidth="1" />
            <SvgText
              x={padding.left - 8}
              y={tick.y + 4}
              fontSize="10"
              fill={axisColor}
              textAnchor="end"
              alignmentBaseline="middle"
            >
              {Math.round(tick.value / 60)}h
            </SvgText>
          </G>
        ))}

        {/* X-axis line */}
        <Line x1={padding.left} y1={padding.top + innerHeight} x2={padding.left + innerWidth} y2={padding.top + innerHeight} stroke={axisColor} strokeWidth="1" />

        {/* X-axis ticks and labels */}
        {xTicks.map((tick, i) => (
          <G key={`x-${i}`}>
            <Line x1={tick.x} y1={padding.top + innerHeight} x2={tick.x} y2={padding.top + innerHeight + 4} stroke={axisColor} strokeWidth="1" />
            <SvgText
              x={tick.x}
              y={padding.top + innerHeight + 20}
              fontSize="9"
              fill={axisColor}
              textAnchor="middle"
            >
              {String(tick.label).slice(0, 5)}
            </SvgText>
          </G>
        ))}

        {/* Data line */}
        <Path d={linePath} stroke={lineColor} strokeWidth="2" fill="none" />
        
        {/* Data points */}
        {points.map((p, i) => (
          <G key={`point-${i}`}>
            <Path d={`M ${p.x} ${p.y} L ${p.x} ${p.y}`} stroke={lineColor} strokeWidth="4" />
          </G>
        ))}
      </Svg>
    </View>
  );
}
