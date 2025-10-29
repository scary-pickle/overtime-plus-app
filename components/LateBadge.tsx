import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getCurrentTime, timeToMinutes, formatMinutes } from '../lib/time';

interface LateBadgeProps {
  rosteredFinish?: string;
  actualFinish?: string;
  style?: any;
}

export function LateBadge({ rosteredFinish, actualFinish, style }: LateBadgeProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [isLate, setIsLate] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!rosteredFinish || actualFinish) {
      setIsLate(false);
      setLateMinutes(0);
      return;
    }

    const currentMinutes = timeToMinutes(currentTime);
    const rosteredMinutes = timeToMinutes(rosteredFinish);
    
    if (currentMinutes > rosteredMinutes) {
      setIsLate(true);
      setLateMinutes(currentMinutes - rosteredMinutes);
    } else {
      setIsLate(false);
      setLateMinutes(0);
    }
  }, [currentTime, rosteredFinish, actualFinish]);

  if (!isLate || !rosteredFinish) {
    return null;
  }

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>
        +{formatMinutes(lateMinutes)} late
      </Text>
    </View>
  );
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
});
