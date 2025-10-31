import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useLogsStore } from '../../lib/state/logsStore';
import BarChart from '../../components/charts/Line';
import Pie from '../../components/charts/Pie';
import { CalendarPicker } from '../../components/CalendarPicker';
import {
  bucketByDay,
  getCategoryBreakdown,
  getFortnightSummary,
  getLast30DaysRange,
  getLogsInRange,
  sumMinutes,
} from '../../lib/analytics';

type RangeMode = 'month' | 'week' | 'custom';

export default function AnalyticsScreen() {
  const { logs, loadLogs } = useLogsStore();
  const [mode, setMode] = useState<RangeMode>('month');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Load logs when screen mounts
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Date range state (custom)
  const defaultRange = getLast30DaysRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  // Resolve active range
  const activeRange = useMemo(() => {
    if (mode === 'custom') return { start: startDate, end: endDate };
    return defaultRange; // month = last 30 days default
  }, [mode, startDate, endDate, defaultRange]);

  // Filter logs and compute series - include ALL logs regardless of status
  const filtered = useMemo(() => {
    const result = getLogsInRange(logs, activeRange);
    console.log('Analytics Debug:', {
      totalLogs: logs.length,
      activeRange,
      filteredCount: result.length,
      filteredDates: result.map(l => ({ date: l.date, minutes: l.minutesOvertime, status: l.status })),
    });
    return result;
  }, [logs, activeRange]);
  const totalMinutes = useMemo(() => sumMinutes(filtered), [filtered]);
  const daySeries = useMemo(() => bucketByDay(filtered, activeRange).map((d) => ({ x: d.date.slice(5), y: d.minutes })), [filtered, activeRange]);
  const categorySeries = useMemo(() => getCategoryBreakdown(filtered).map((c) => ({ x: c.category, y: c.minutes })), [filtered]);
  const fortnightMinutes = useMemo(() => getFortnightSummary(new Date(), logs), [logs]);

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      {/* Page header */}
      <View style={[styles.headerRow, isDark && styles.darkHeaderRow]}>
        <Text style={[styles.title, isDark && styles.darkTitle]}>Analytics</Text>
        <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>Insights from your overtime logs</Text>
      </View>

      {/* Range selector */}
      <View style={[styles.segment, isDark && styles.darkSegment]}>
        {(['month', 'custom'] as RangeMode[]).map((key) => (
          <TouchableOpacity key={key} style={[styles.segmentBtn, mode === key && styles.segmentBtnActive]} onPress={() => setMode(key)}>
            <Text style={[styles.segmentText, mode === key && styles.segmentTextActive]}>
              {key === 'month' ? 'Last 30 days' : 'Custom'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'custom' && (
        <View style={styles.rangePickers}>
          <View style={styles.pickerCol}>
            <Text style={[styles.label, isDark && styles.darkText]}>Start</Text>
            <CalendarPicker value={startDate} onChange={setStartDate} />
          </View>
          <View style={styles.pickerCol}>
            <Text style={[styles.label, isDark && styles.darkText]}>End</Text>
            <CalendarPicker value={endDate} onChange={setEndDate} />
          </View>
        </View>
      )}

      {/* Summary tiles */}
      <View style={styles.tilesRow}>
        <View style={[styles.tile, isDark && styles.darkTile]}>
          <Text style={[styles.tileLabel, isDark && styles.darkText]}>Total overtime</Text>
          <Text style={styles.tileValue}>{Math.round(totalMinutes / 60)}h</Text>
        </View>
        <View style={[styles.tile, isDark && styles.darkTile]}>
          <Text style={[styles.tileLabel, isDark && styles.darkText]}>Fortnight</Text>
          <Text style={styles.tileValue}>{Math.round(fortnightMinutes / 60)}h</Text>
        </View>
      </View>

      {/* Trend */}
      <View style={[styles.card, isDark && styles.darkCard]}>
        <Text style={[styles.cardTitle, isDark && styles.darkText]}>Overtime trend</Text>
        {daySeries.length > 0 ? (
        <BarChart data={daySeries} />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={[styles.emptyText, isDark && styles.darkText]}>
              No data in this range. Try selecting "Custom" to choose a different date range.
            </Text>
          </View>
        )}
      </View>

      {/* Categories */}
      <View style={[styles.card, isDark && styles.darkCard]}>
        <Text style={[styles.cardTitle, isDark && styles.darkText]}>Category breakdown</Text>
        {categorySeries.length > 0 ? (
          <Pie data={categorySeries} />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={[styles.emptyText, isDark && styles.darkText]}>
              No category data in this range.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  darkContainer: { backgroundColor: '#000' },
  headerRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, backgroundColor: '#fff' },
  darkHeaderRow: { backgroundColor: '#000' },
  title: { fontSize: 26, fontWeight: '800', color: '#111' },
  darkTitle: { color: '#fff' },
  subtitle: { marginTop: 2, color: '#666', fontSize: 12 },
  darkSubtitle: { color: '#aaa' },
  darkText: { color: '#fff' },
  segment: { flexDirection: 'row', backgroundColor: '#f2f2f7', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  darkSegment: { backgroundColor: '#1c1c1e' },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#fff', borderRadius: 12 },
  segmentText: { color: '#333', fontWeight: '600' },
  segmentTextActive: { color: '#007AFF' },
  rangePickers: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  pickerCol: { flex: 1 },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },
  tilesRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center' },
  darkTile: { backgroundColor: '#1c1c1e' },
  tileLabel: { fontSize: 12, color: '#666' },
  tileValue: { fontSize: 22, fontWeight: '700', color: '#007AFF', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, margin: 16 },
  darkCard: { backgroundColor: '#1c1c1e' },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#333' },
  debugText: { fontSize: 12, fontFamily: 'monospace', color: '#666' },
  emptyChart: { height: 220, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
});


