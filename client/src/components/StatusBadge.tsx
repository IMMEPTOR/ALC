import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS: Record<string, string> = {
  online: '#22c55e',
  active: '#22c55e',
  good: '#22c55e',
  offline: '#6b7280',
  inactive: '#6b7280',
  warning: '#f59e0b',
  uncertain: '#f59e0b',
  acknowledged: '#f59e0b',
  critical: '#ef4444',
  bad: '#ef4444',
  maintenance: '#3b82f6',
  info: '#3b82f6',
  resolved: '#6b7280',
  pending: '#f59e0b',
  executing: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
};

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'sm' }) => {
  const color = COLORS[status] || '#6b7280';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }, size === 'md' && styles.badgeMd]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, size === 'md' && styles.textMd]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeMd: { paddingHorizontal: 12, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  text: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  textMd: { fontSize: 13 },
});
