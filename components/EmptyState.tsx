import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText: string;
  onAction: () => void;
  icon?: string;
}

export function EmptyState({ 
  title, 
  description, 
  actionText, 
  onAction, 
  icon = '📝' 
}: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, isDark && styles.darkText]}>{title}</Text>
      <Text style={[styles.description, isDark && styles.darkDescription]}>{description}</Text>
      <TouchableOpacity style={styles.actionButton} onPress={onAction}>
        <Text style={styles.actionText}>{actionText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  darkText: {
    color: '#fff',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  darkDescription: {
    color: '#999',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
