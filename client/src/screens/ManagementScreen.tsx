import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import http from '../api/http';

export const ManagementScreen: React.FC = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'sites' | 'lines' | 'nodes'>('sites');

  // Forms
  const [showForm, setShowForm] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [lineName, setLineName] = useState('');
  const [lineSiteId, setLineSiteId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState('');
  const [nodeIp, setNodeIp] = useState('');
  const [nodeLineId, setNodeLineId] = useState('');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error' | 'info'>('info');

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setModalTitle(title); setModalMessage(message); setModalType(type); setModalVisible(true);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, n] = await Promise.all([
        http.get('/sites'), http.get('/lines'), http.get('/nodes'),
      ]);
      setSites(s.data); setLines(l.data); setNodes(n.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);

  const createSite = async () => {
    if (!siteName.trim() || !siteLocation.trim()) { showModal('Ошибка', 'Заполните все поля', 'error'); return; }
    try {
      await http.post('/sites', { name: siteName.trim(), location: siteLocation.trim() });
      showModal('Успешно', 'Площадка создана', 'success');
      setSiteName(''); setSiteLocation(''); setShowForm(false); loadAll();
    } catch (err: any) { showModal('Ошибка', err.response?.data?.error || 'Не удалось создать', 'error'); }
  };

  const createLine = async () => {
    if (!lineName.trim() || !lineSiteId) { showModal('Ошибка', 'Укажите название и площадку', 'error'); return; }
    try {
      await http.post('/lines', { name: lineName.trim(), site_id: lineSiteId });
      showModal('Успешно', 'Линия создана', 'success');
      setLineName(''); setLineSiteId(''); setShowForm(false); loadAll();
    } catch (err: any) { showModal('Ошибка', err.response?.data?.error || 'Не удалось создать', 'error'); }
  };

  const createNode = async () => {
    if (!nodeName.trim() || !nodeType.trim() || !nodeIp.trim() || !nodeLineId) {
      showModal('Ошибка', 'Заполните все поля', 'error'); return;
    }
    try {
      await http.post('/nodes', { name: nodeName.trim(), type: nodeType.trim(), ip_address: nodeIp.trim(), line_id: nodeLineId });
      showModal('Успешно', 'Узел создан', 'success');
      setNodeName(''); setNodeType(''); setNodeIp(''); setNodeLineId(''); setShowForm(false); loadAll();
    } catch (err: any) { showModal('Ошибка', err.response?.data?.error || 'Не удалось создать', 'error'); }
  };

  const deleteSite = async (id: string) => {
    try { await http.delete(`/sites/${id}`); loadAll(); } catch (err: any) { showModal('Ошибка', err.response?.data?.error || 'Ошибка', 'error'); }
  };
  const deleteLine = async (id: string) => {
    try { await http.delete(`/lines/${id}`); loadAll(); } catch (err: any) { showModal('Ошибка', err.response?.data?.error || 'Ошибка', 'error'); }
  };
  const deleteNode = async (id: string) => {
    try { await http.delete(`/nodes/${id}`); loadAll(); } catch (err: any) { showModal('Ошибка', err.response?.data?.error || 'Ошибка', 'error'); }
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} />}>
      <Modal visible={modalVisible} title={modalTitle} message={modalMessage} type={modalType} onClose={() => setModalVisible(false)} />

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['sites', 'lines', 'nodes'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => { setTab(t); setShowForm(false); }}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'sites' ? `Площадки (${sites.length})` : t === 'lines' ? `Линии (${lines.length})` : `Узлы (${nodes.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add button */}
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
        <Text style={styles.addBtnText}>{showForm ? 'Отмена' : 'Создать'}</Text>
      </TouchableOpacity>

      {/* Create forms */}
      {showForm && tab === 'sites' && (
        <Card>
          <Text style={styles.formTitle}>Новая площадка</Text>
          <TextInput style={styles.input} placeholder="Название" value={siteName} onChangeText={setSiteName} placeholderTextColor="#94a3b8" />
          <TextInput style={styles.input} placeholder="Адрес" value={siteLocation} onChangeText={setSiteLocation} placeholderTextColor="#94a3b8" />
          <TouchableOpacity style={styles.createBtn} onPress={createSite}><Text style={styles.createBtnText}>Создать площадку</Text></TouchableOpacity>
        </Card>
      )}

      {showForm && tab === 'lines' && (
        <Card>
          <Text style={styles.formTitle}>Новая линия</Text>
          <TextInput style={styles.input} placeholder="Название линии" value={lineName} onChangeText={setLineName} placeholderTextColor="#94a3b8" />
          <Text style={styles.fieldLabel}>Площадка:</Text>
          {sites.map(s => (
            <TouchableOpacity key={s._id} style={[styles.selectItem, lineSiteId === s._id && styles.selectItemActive]} onPress={() => setLineSiteId(s._id)}>
              <Text style={[styles.selectItemText, lineSiteId === s._id && { color: '#3b82f6' }]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.createBtn, { marginTop: 12 }]} onPress={createLine}><Text style={styles.createBtnText}>Создать линию</Text></TouchableOpacity>
        </Card>
      )}

      {showForm && tab === 'nodes' && (
        <Card>
          <Text style={styles.formTitle}>Новый узел</Text>
          <TextInput style={styles.input} placeholder="Название узла" value={nodeName} onChangeText={setNodeName} placeholderTextColor="#94a3b8" />
          <TextInput style={styles.input} placeholder="Тип (welding_robot, conveyor...)" value={nodeType} onChangeText={setNodeType} placeholderTextColor="#94a3b8" />
          <TextInput style={styles.input} placeholder="IP-адрес" value={nodeIp} onChangeText={setNodeIp} placeholderTextColor="#94a3b8" />
          <Text style={styles.fieldLabel}>Линия:</Text>
          {lines.map(l => (
            <TouchableOpacity key={l._id} style={[styles.selectItem, nodeLineId === l._id && styles.selectItemActive]} onPress={() => setNodeLineId(l._id)}>
              <Text style={[styles.selectItemText, nodeLineId === l._id && { color: '#3b82f6' }]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.createBtn, { marginTop: 12 }]} onPress={createNode}><Text style={styles.createBtnText}>Создать узел</Text></TouchableOpacity>
        </Card>
      )}

      {/* List items */}
      {tab === 'sites' && sites.map(s => (
        <Card key={s._id}>
          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{s.name}</Text>
              <Text style={styles.itemSub}>{s.location}</Text>
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteSite(s._id)}>
              <Text style={styles.deleteBtnText}>Удалить</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      {tab === 'lines' && lines.map(l => {
        const siteName2 = typeof l.site_id === 'object' ? l.site_id.name : '';
        return (
          <Card key={l._id}>
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{l.name}</Text>
                <Text style={styles.itemSub}>{siteName2}</Text>
              </View>
              <StatusBadge status={l.status} />
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteLine(l._id)}>
                <Text style={styles.deleteBtnText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      {tab === 'nodes' && nodes.map(n => {
        const lineName2 = typeof n.line_id === 'object' ? n.line_id.name : '';
        return (
          <Card key={n._id}>
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{n.name}</Text>
                <Text style={styles.itemSub}>{n.type} | {n.ip_address} | {lineName2}</Text>
              </View>
              <StatusBadge status={n.status} />
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNode(n._id)}>
                <Text style={styles.deleteBtnText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  tabRow: { flexDirection: 'row', padding: 12, gap: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e8ecf0', borderWidth: 1, borderColor: '#dde1e6' },
  tabBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  tabText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  addBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-start', marginLeft: 12, marginBottom: 12 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, marginBottom: 10, color: '#1e293b', fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 4 },
  selectItem: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
  selectItemActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  selectItemText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  createBtn: { backgroundColor: '#22c55e', borderRadius: 8, padding: 14, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  itemSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  deleteBtn: { backgroundColor: '#ef4444', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: '#fff', fontWeight: '600', fontSize: 11 },
});
