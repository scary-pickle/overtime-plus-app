import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLogsStore } from '../../lib/state/logsStore';
import { useLocalUserStore } from '../../lib/state/localUserStore';
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
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('Analytics');

type RangeMode = 'month' | 'week' | 'custom';

export default function AnalyticsScreen() {
  const { localUserId } = useLocalUserStore();
  const { logs, loadLogs } = useLogsStore();
  const [mode, setMode] = useState<RangeMode>('month');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Hide the default navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Load logs when screen mounts
  useEffect(() => {
    loadLogs(localUserId);
  }, [loadLogs, localUserId]);

  // Date range state (custom)
  const defaultRange = getLast30DaysRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  // Resolve active range
  const activeRange = useMemo(() => {
    if (mode === 'custom') return { start: startDate, end: endDate };
    return defaultRange; // month = last 30 days default
  }, [mode, startDate, endDate, defaultRange]);

  // Filter logs and compute series - exclude shift swaps as they aren't technically overtime
  const filtered = useMemo(() => {
    const result = getLogsInRange(logs, activeRange).filter(log => !log.isShiftSwap);
    debug.debug('Analytics Debug:', {
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
  const fortnightMinutes = useMemo(() => {
    const fortnightLogs = logs.filter(log => !log.isShiftSwap);
    return getFortnightSummary(new Date(), fortnightLogs);
  }, [logs]);

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.darkText]}>
          Analytics
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Page header */}
      <View style={[styles.headerRow, isDark && styles.darkHeaderRow]}>
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

      {/* Categories - only show if there are multiple categories */}
      {categorySeries.length > 1 && (
        <View style={[styles.card, isDark && styles.darkCard]}>
          <Text style={[styles.cardTitle, isDark && styles.darkText]}>Category breakdown</Text>
          <Pie data={categorySeries} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  darkContainer: { backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the title
  },
  headerRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: '#fff' },
  darkHeaderRow: { backgroundColor: '#000' },
  subtitle: { marginTop: 4, color: '#666', fontSize: 14, lineHeight: 20, letterSpacing: 0.2 },
  darkSubtitle: { color: '#aaa' },
  darkText: { color: '#fff' },
  segment: { flexDirection: 'row', backgroundColor: '#f2f2f7', marginHorizontal: 16, marginTop: 16, borderRadius: 12, overflow: 'hidden' },
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


