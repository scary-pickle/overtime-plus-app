import React from 'react';
import { View, Text, useColorScheme, StyleSheet } from 'react-native';
import Svg, { Path, Line as SvgLine, G, Text as SvgText, Rect } from 'react-native-svg';

type Point = { x: string | number; y: number };

interface LineProps {
  data: Point[];
  height?: number;
  xTickCount?: number;
}

export default function BarChart({ data, height = 220, xTickCount = 6 }: LineProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!data || data.length === 0) {
    return <View style={{ height, borderRadius: 12, backgroundColor: isDark ? '#223' : '#e8f0fe' }} />;
  }

  const axisColor = isDark ? '#aaa' : '#666';
  const barColor = '#007AFF';
  const textColor = isDark ? '#fff' : '#333';

  const padding = { top: 16, bottom: 40, left: 48, right: 16 };
  const innerWidth = 300 - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Get min/max for scaling
  const values = data.map((d) => d.y);
  const minY = Math.min(...values, 0);
  const maxY = Math.max(...values, 1);

  // Calculate bar width
  const barCount = data.length;
  const barSpacing = innerWidth / barCount;
  const barWidth = Math.max(4, barSpacing * 0.6); // 60% of spacing, minimum 4px

  // Map data to bar positions
  const bars = data.map((d, i) => {
    const x = padding.left + (i * barSpacing) + (barSpacing - barWidth) / 2;
    const barHeight = ((d.y - minY) / (maxY - minY || 1)) * innerHeight;
    const y = padding.top + innerHeight - barHeight;
    return { 
      x, 
      y, 
      width: barWidth, 
      height: barHeight, 
      value: d.y, 
      label: String(d.x) 
    };
  });

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
    const bar = bars[i];
    if (bar) {
      xTicks.push({ index: i, x: bar.x + bar.width / 2, label: bar.label });
    }
  }
  if (xTicks.length > 0 && xTicks[xTicks.length - 1].index !== data.length - 1) {
    const lastBar = bars[bars.length - 1];
    if (lastBar) {
      xTicks.push({ index: data.length - 1, x: lastBar.x + lastBar.width / 2, label: lastBar.label });
    }
  }

  return (
    <View style={{ height }}>
      <Svg width={300} height={height} style={{ backgroundColor: 'transparent' }}>
        {/* Y-axis line */}
        <SvgLine x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerHeight} stroke={axisColor} strokeWidth="1" />
        
        {/* Y-axis ticks and labels */}
        {yTicks.map((tick, i) => (
          <G key={`y-${i}`}>
            <SvgLine x1={padding.left} y1={tick.y} x2={padding.left - 4} y2={tick.y} stroke={axisColor} strokeWidth="1" />
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
        <SvgLine x1={padding.left} y1={padding.top + innerHeight} x2={padding.left + innerWidth} y2={padding.top + innerHeight} stroke={axisColor} strokeWidth="1" />

        {/* X-axis ticks and labels */}
        {xTicks.map((tick, i) => (
          <G key={`x-${i}`}>
            <SvgLine x1={tick.x} y1={padding.top + innerHeight} x2={tick.x} y2={padding.top + innerHeight + 4} stroke={axisColor} strokeWidth="1" />
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

        {/* Bars */}
        {bars.map((bar, i) => (
          <G key={`bar-${i}`}>
            <Rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={barColor}
              rx={2}
            />
            {/* Value label on top of bar if it's tall enough */}
            {bar.height > 20 && (
              <SvgText
                x={bar.x + bar.width / 2}
                y={bar.y - 4}
                fontSize="9"
                fill={barColor}
                textAnchor="middle"
                fontWeight="600"
              >
                {Math.round(bar.value / 60)}h
              </SvgText>
            )}
          </G>
        ))}
      </Svg>
    </View>
  );
}
