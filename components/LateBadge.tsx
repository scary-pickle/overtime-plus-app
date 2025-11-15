import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getCurrentTime, timeToMinutes, formatMinutes } from '../lib/time';

interface LateBadgeProps {
  rosteredFinish?: string;
  actualFinish?: string;
  isLogged?: boolean;
  style?: any;
}

export function LateBadge({ rosteredFinish, actualFinish, isLogged = false, style }: LateBadgeProps) {
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

    const currentMinutes = timeToMinutes(currentTime);
    const rosteredMinutes = timeToMinutes(rosteredFinish);
    
    // Check if shift has passed
    setHasShiftPassed(currentMinutes > rosteredMinutes);
    
    // Only show late badge if shift has passed, no actual finish time, and not logged
    if (actualFinish) {
      setIsLate(false);
      setLateMinutes(0);
      return;
    }

    if (currentMinutes > rosteredMinutes && !isLogged) {
      setIsLate(true);
      setLateMinutes(currentMinutes - rosteredMinutes);
    } else {
      setIsLate(false);
      setLateMinutes(0);
    }
  }, [currentTime, rosteredFinish, actualFinish, isLogged]);

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
