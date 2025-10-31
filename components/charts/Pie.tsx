import React from 'react';
import { View, Text, useColorScheme, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';

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

  if (!data || data.length === 0) {
    return <View style={{ height, borderRadius: 12, backgroundColor: isDark ? '#223' : '#e8f0fe' }} />;
  }

  const size = height;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 3;
  const innerRadius = 40;

  // Calculate total for percentages
  const total = data.reduce((sum, d) => sum + d.y, 0);
  if (total === 0) {
    return <View style={{ height, borderRadius: 12, backgroundColor: isDark ? '#223' : '#e8f0fe' }} />;
  }

  // Generate pie slices
  let currentAngle = -90; // Start at top
  const slices = data.map((d, i) => {
    const percentage = d.y / total;
    const sliceAngle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    // Convert angles to radians
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    // Calculate outer arc points
    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);

    // Calculate inner arc points
    const x3 = centerX + innerRadius * Math.cos(endAngleRad);
    const y3 = centerY + innerRadius * Math.sin(endAngleRad);
    const x4 = centerX + innerRadius * Math.cos(startAngleRad);
    const y4 = centerY + innerRadius * Math.sin(startAngleRad);

    // Large arc flag (1 if slice is > 180 degrees)
    const largeArcFlag = sliceAngle > 180 ? 1 : 0;

    // Create path for donut slice
    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`, // Outer arc
      `L ${x3} ${y3}`, // Line to inner
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`, // Inner arc
      'Z', // Close path
    ].join(' ');

    // Calculate label position (middle of slice, outside)
    const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
    const labelRadius = radius + 30;
    const labelX = centerX + labelRadius * Math.cos(midAngle);
    const labelY = centerY + labelRadius * Math.sin(midAngle);

    currentAngle = endAngle;

    return {
      pathData,
      color: colors[i % colors.length],
      label: `${d.x} ${(d.y / 60).toFixed(1)}h`,
      labelX,
      labelY,
      percentage,
    };
  });

  return (
    <View style={{ height }}>
      <Svg width={size} height={size} style={{ backgroundColor: 'transparent' }}>
        {slices.map((slice, i) => (
          <G key={`slice-${i}`}>
            <Path d={slice.pathData} fill={slice.color} stroke={isDark ? '#1c1c1e' : '#fff'} strokeWidth="2" />
            {slice.percentage > 0.05 && ( // Only show labels for slices > 5%
              <SvgText
                x={slice.labelX}
                y={slice.labelY}
                fontSize="10"
                fill={isDark ? '#fff' : '#333'}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {slice.label}
              </SvgText>
            )}
          </G>
        ))}
      </Svg>
      
      {/* Legend below chart */}
      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: colors[i % colors.length] }]} />
            <Text style={[styles.legendText, { color: isDark ? '#fff' : '#333' }]}>
              {d.x}: {(d.y / 60).toFixed(1)}h
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
  },
});
