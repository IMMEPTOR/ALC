import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchAlerts, acknowledgeAlert, resolveAlert } from '../store/slices/alertsSlice';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';

const SEVERITY_COLORS = { info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444' };

export const AlertsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { alerts, loading } = useSelector((state: RootState) => state.alerts);
  const { user } = useSelector((state: RootState) => state.auth);
  const [filter, setFilter] = useState<string>('all');

  const loadAlerts = () => dispatch(fetchAlerts(filter !== 'all' ? { status: filter } : undefined));

  useEffect(() => { loadAlerts(); }, [filter]);

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter(a => a.status === filter);

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filterRow}>
        {['all', 'active', 'acknowledged', 'resolved'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : f === 'acknowledged' ? 'Принятые' : 'Решённые'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredAlerts}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAlerts} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Нет алармов</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sevColor = SEVERITY_COLORS[item.severity] || '#6b7280';
          const nodeName = typeof item.node_id === 'object' ? (item.node_id as any).name : item.node_id;
          return (
            <Card style={{ borderLeftWidth: 4, borderLeftColor: sevColor }}>
              <View style={styles.alertHeader}>
                <StatusBadge status={item.severity} />
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.alertMessage}>{item.message}</Text>
              <Text style={styles.alertMeta}>
                Узел: {nodeName} | {new Date(item.created_at).toLocaleString()}
              </Text>
              {item.status === 'active' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
                    onPress={() => dispatch(acknowledgeAlert(item._id))}
                  >
                    <Text style={styles.actionBtnText}>Принять</Text>
                  </TouchableOpacity>
                  {(user?.role === 'engineer' || user?.role === 'admin') && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                      onPress={() => dispatch(resolveAlert(item._id))}
                    >
                      <Text style={styles.actionBtnText}>Решить</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {item.status === 'acknowledged' && (user?.role === 'engineer' || user?.role === 'admin') && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#22c55e', marginTop: 8 }]}
                  onPress={() => dispatch(resolveAlert(item._id))}
                >
                  <Text style={styles.actionBtnText}>Решить</Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#e8ecf0', borderWidth: 1, borderColor: '#dde1e6',
  },
  filterBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  alertHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  alertMessage: { fontSize: 13, color: '#1e293b', fontWeight: '500', lineHeight: 20 },
  alertMeta: { fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
});
