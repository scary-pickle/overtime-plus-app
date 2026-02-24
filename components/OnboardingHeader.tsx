import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OnboardingHeaderProps {
  step: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightActionLabel?: string;
  onRightAction?: () => void;
  align?: 'left' | 'center';
  compact?: boolean;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
}

export function OnboardingHeader({
  step,
  totalSteps = 6,
  title,
  subtitle,
  onBack,
  rightActionLabel,
  onRightAction,
  align = 'center',
  compact = false,
  containerStyle,
  titleStyle,
  subtitleStyle,
}: OnboardingHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const showBack = !!onBack;
  const showRightAction = !!rightActionLabel && !!onRightAction;
  const sideSlot = compact ? 56 : 44;

  return (
    <View style={containerStyle}>
      <View style={styles.utilityRow}>
        {showBack ? (
          <TouchableOpacity
            style={[styles.iconButton, compact && styles.iconButtonCompact]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={compact ? 18 : 20} color={isDark ? '#93c5fd' : '#1d4ed8'} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: sideSlot }} />
        )}

        <View style={[styles.stepPill, isDark && styles.darkStepPill]}>
          <Text style={[styles.stepPillText, isDark && styles.darkStepPillText]}>
            Step {step} of {totalSteps}
          </Text>
        </View>

        {showRightAction ? (
          <TouchableOpacity
            style={[styles.textAction, compact && styles.textActionCompact]}
            onPress={onRightAction}
            accessibilityRole="button"
            accessibilityLabel={rightActionLabel}
          >
            <Text style={[styles.textActionText, isDark && styles.darkTextActionText]}>{rightActionLabel}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: sideSlot }} />
        )}
      </View>

      <Text
        style={[
          styles.title,
          compact && styles.compactTitle,
          align === 'center' ? styles.centerText : styles.leftText,
          isDark && styles.darkTitle,
          titleStyle,
        ]}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            compact && styles.compactSubtitle,
            align === 'center' ? styles.centerText : styles.leftText,
            isDark && styles.darkSubtitle,
            subtitleStyle,
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonCompact: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  textAction: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  textActionCompact: {
    minWidth: 56,
    paddingVertical: 6,
  },
  textActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  darkTextActionText: {
    color: '#64b5f6',
  },
  stepPill: {
    backgroundColor: '#eaf2ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  darkStepPill: {
    backgroundColor: '#10233f',
  },
  stepPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  darkStepPillText: {
    color: '#93c5fd',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  compactTitle: {
    fontSize: 20,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4b5563',
  },
  compactSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  darkTitle: {
    color: '#fff',
  },
  darkSubtitle: {
    color: '#9ca3af',
  },
  centerText: {
    textAlign: 'center',
  },
  leftText: {
    textAlign: 'left',
  },
});
