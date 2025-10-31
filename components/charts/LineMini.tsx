import React from 'react';
import { View, useColorScheme, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';

type Point = { x: number | string; y: number };

interface LineMiniProps {
  data: Point[];
  height?: number;
}

export default function LineMini({ data, height = 80 }: LineMiniProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!data || data.length === 0) {
    return <View style={{ height, borderRadius: 8, backgroundColor: isDark ? '#223' : '#e8f0fe' }} />;
  }

  const accent = '#007AFF';
  const fill = isDark ? 'rgba(0,122,255,0.2)' : 'rgba(0,122,255,0.15)';

  const padding = 8;
  const width = 300; // Fixed width for sparkline
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // Get min/max for scaling
  const values = data.map((d) => d.y);
  const minY = Math.min(...values, 0);
  const maxY = Math.max(...values, 1); // Ensure at least 1 to avoid division by zero

  // Map data to SVG coordinates
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * innerWidth;
    const y = padding + innerHeight - ((d.y - minY) / (maxY - minY || 1)) * innerHeight;
    return { x, y, value: d.y };
  });

  // Create path for area fill
  const areaPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ` L ${points[points.length - 1].x} ${padding + innerHeight} L ${points[0].x} ${padding + innerHeight} Z`;

  // Create path for line
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <View style={{ height }}>
      <Svg width={width} height={height} style={{ backgroundColor: 'transparent' }}>
        <Defs>
          <LinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={accent} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={accent} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#gradient)" />
        <Path d={linePath} stroke={accent} strokeWidth="2" fill="none" />
      </Svg>
    </View>
  );
}
