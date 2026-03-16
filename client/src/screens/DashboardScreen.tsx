import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchNodes } from '../store/slices/nodesSlice';
import { fetchAlerts } from '../store/slices/alertsSlice';
import { fetchSites, fetchLines } from '../store/slices/sitesSlice';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { getSocket } from '../api/socket';
import { updateNodeStatus } from '../store/slices/nodesSlice';
import { addAlert } from '../store/slices/alertsSlice';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { nodes, loading } = useSelector((state: RootState) => state.nodes);
  const { alerts } = useSelector((state: RootState) => state.alerts);
  const { sites, lines } = useSelector((state: RootState) => state.sites);
  const { user } = useSelector((state: RootState) => state.auth);

  const loadData = () => {
    dispatch(fetchNodes());
    dispatch(fetchAlerts({ status: 'active' }));
    dispatch(fetchSites());
    dispatch(fetchLines());
  };

  useEffect(() => {
    loadData();
    const socket = getSocket();
    if (socket) {
      socket.emit('subscribe:alerts');
      socket.on('nodes:statusUpdate', (data: { nodeId: string; status: string }) => {
        dispatch(updateNodeStatus(data));
      });
      socket.on('alert:new', (alert: any) => {
        dispatch(addAlert(alert));
      });
    }
  }, []);

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const criticalNodes = nodes.filter(n => n.status === 'critical');
  const warningNodes = nodes.filter(n => n.status === 'warning');

  return (
    <View style={styles.container}>
      <FlatList
        data={nodes}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.greeting}>
              {user?.username} ({user?.role})
            </Text>

            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{nodes.length}</Text>
                <Text style={styles.summaryLabel}>Узлов</Text>
              </Card>
              <Card style={[styles.summaryCard, { borderLeftColor: '#ef4444', borderLeftWidth: 3 }]}>
                <Text style={[styles.summaryNumber, { color: '#ef4444' }]}>{criticalNodes.length}</Text>
                <Text style={styles.summaryLabel}>Критических</Text>
              </Card>
              <Card style={[styles.summaryCard, { borderLeftColor: '#f59e0b', borderLeftWidth: 3 }]}>
                <Text style={[styles.summaryNumber, { color: '#f59e0b' }]}>{activeAlerts.length}</Text>
                <Text style={styles.summaryLabel}>Алармов</Text>
              </Card>
            </View>

            {/* Sites overview */}
            <Text style={styles.sectionTitle}>Площадки</Text>
            {sites.map(site => (
              <Card key={site._id}>
                <Text style={styles.siteName}>{site.name}</Text>
                <Text style={styles.siteLocation}>{site.location}</Text>
                <View style={styles.linesRow}>
                  {lines.filter(l => {
                    const siteId = typeof l.site_id === 'string' ? l.site_id : (l.site_id as any)._id;
                    return siteId === site._id;
                  }).map(line => (
                    <View key={line._id} style={styles.lineChip}>
                      <StatusBadge status={line.status} />
                      <Text style={styles.lineName}>{line.name}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ))}

            <Text style={styles.sectionTitle}>Технологические узлы</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('NodeDetail', { nodeId: item._id, title: item.name })}>
            <Card>
              <View style={styles.nodeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeName}>{item.name}</Text>
                  <Text style={styles.nodeType}>{item.type} | {item.ip_address}</Text>
                </View>
                <StatusBadge status={item.status} size="md" />
              </View>
              <Text style={styles.paramCount}>{item.parameters.length} параметров</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  greeting: {
    fontSize: 13, color: '#64748b', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
    fontWeight: '500', letterSpacing: 0.2,
  },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 4, gap: 6, marginTop: 4 },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  summaryNumber: { fontSize: 26, fontWeight: '800', color: '#1e293b' },
  summaryLabel: { fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: '#334155', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8,
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  siteName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  siteLocation: { fontSize: 12, color: '#64748b', marginTop: 3 },
  linesRow: { marginTop: 10, gap: 6 },
  lineChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineName: { fontSize: 13, color: '#475569', fontWeight: '500' },
  nodeHeader: { flexDirection: 'row', alignItems: 'center' },
  nodeName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  nodeType: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  paramCount: { fontSize: 11, color: '#64748b', marginTop: 8, fontWeight: '500' },
});
