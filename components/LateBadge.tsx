import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getCurrentTime, formatMinutes } from '../lib/time';

interface LateBadgeProps {
  rosteredStart?: string;
  rosteredFinish?: string;
  actualFinish?: string;
  isLogged?: boolean;
  style?: any;
}

// Convert an HH:mm string into a Date on the provided reference day
function timeStringToDate(timeStr: string, reference: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(reference);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function LateBadge({ rosteredStart, rosteredFinish, actualFinish, isLogged = false, style }: LateBadgeProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [isLate, setIsLate] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [hasShiftPassed, setHasShiftPassed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!rosteredFinish) {
      setIsLate(false);
      setLateMinutes(0);
      setHasShiftPassed(false);
      return;
    }

    const now = new Date();
    const finishDate = timeStringToDate(rosteredFinish, now);

    if (rosteredStart) {
      const startDate = timeStringToDate(rosteredStart, now);
      // Overnight shift: finish time is earlier than or equal to start time, so it ends the next day
      if (finishDate <= startDate) {
        finishDate.setDate(finishDate.getDate() + 1);
      }
    }
    
    // Check if shift has passed
    const shiftHasPassed = now > finishDate;
    setHasShiftPassed(shiftHasPassed);
    
    // Only show late badge if shift has passed, no actual finish time, and not logged
    if (actualFinish && actualFinish !== 'N/A') {
      setIsLate(false);
      setLateMinutes(0);
      return;
    }

    if (shiftHasPassed && !isLogged) {
      const minutesLate = Math.max(
        0,
        Math.floor((now.getTime() - finishDate.getTime()) / (1000 * 60))
      );
      setIsLate(true);
      setLateMinutes(minutesLate);
    } else {
      setIsLate(false);
      setLateMinutes(0);
    }
  }, [currentTime, rosteredStart, rosteredFinish, actualFinish, isLogged]);

  // Show "Logged" badge if shift has passed and is logged
  if (hasShiftPassed && isLogged && rosteredFinish) {
    return (
      <View style={[styles.badge, styles.loggedBadge, style]}>
        <Text style={styles.loggedBadgeText}>
          Logged
        </Text>
      </View>
    );
  }

  // Show late badge if shift has passed, not logged, and no actual finish
  if (isLate && !isLogged && rosteredFinish) {
    return (
      <View style={[styles.badge, style]}>
        <Text style={styles.badgeText}>
          +{formatMinutes(lateMinutes)} late
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loggedBadge: {
    backgroundColor: '#4CAF50',
  },
  loggedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
