import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchNodeById, fetchLatestTelemetry } from '../store/slices/nodesSlice';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { getSocket } from '../api/socket';
import http from '../api/http';
import Svg, { Polyline, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const CHART_POINTS = 20;
const CHART_W = Dimensions.get('window').width - 64;
const CHART_H = 100;
const PAD_LEFT = 6;
const PAD_RIGHT = 48;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

const Sparkline: React.FC<{ data: number[]; min: number; max: number; color: string }> = ({ data, min, max, color }) => {
  if (data.length < 2) return null;
  const range = max - min || 1;
  const padMin = min - range * 0.2;
  const padMax = max + range * 0.2;
  const padRange = padMax - padMin;
  const stepX = PLOT_W / (CHART_POINTS - 1);

  const toX = (i: number) => PAD_LEFT + i * stepX;
  const toY = (v: number) => PAD_TOP + PLOT_H - ((v - padMin) / padRange) * PLOT_H;

  const pts = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const minY = toY(min);
  const maxY = toY(max);

  // Area fill path
  const firstX = toX(0);
  const lastX = toX(data.length - 1);
  const areaPoints = `${firstX},${PAD_TOP + PLOT_H} ${pts} ${lastX},${PAD_TOP + PLOT_H}`;

  const gradId = `grad_${color.replace('#', '')}`;

  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.18" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Threshold lines */}
        <Line x1={PAD_LEFT} y1={minY} x2={CHART_W - PAD_RIGHT} y2={minY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,3" />
        <Line x1={PAD_LEFT} y1={maxY} x2={CHART_W - PAD_RIGHT} y2={maxY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,3" />

        {/* Threshold labels */}
        <SvgText x={CHART_W - PAD_RIGHT + 4} y={maxY + 3} fontSize="9" fill="#94a3b8">max {max}</SvgText>
        <SvgText x={CHART_W - PAD_RIGHT + 4} y={minY + 3} fontSize="9" fill="#94a3b8">min {min}</SvgText>

        {/* Area fill */}
        <Polyline points={areaPoints} fill={`url(#${gradId})`} stroke="none" />

        {/* Main line */}
        <Polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {data.map((v, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(v)} r={i === data.length - 1 ? 4 : 2.5} fill={color} stroke="#fff" strokeWidth={i === data.length - 1 ? 2 : 1} />
        ))}
      </Svg>
    </View>
  );
};

const QUICK_COMMANDS = [
  { label: 'Старт', action: 'start', color: '#22c55e', description: 'Запустить узел' },
  { label: 'Стоп', action: 'stop', color: '#ef4444', description: 'Остановить узел' },
  { label: 'Рестарт', action: 'restart', color: '#3b82f6', description: 'Перезагрузить узел' },
  { label: 'Аварийный стоп', action: 'emergency_stop', color: '#991b1b', description: 'Экстренная остановка' },
  { label: 'Калибровка', action: 'calibrate', color: '#8b5cf6', description: 'Калибровать датчики' },
  { label: 'Диагностика', action: 'diagnostics', color: '#0ea5e9', description: 'Запустить диагностику' },
  { label: 'Сброс алармов', action: 'reset_alerts', color: '#64748b', description: 'Сбросить тревоги' },
];

const COMMANDS_BY_ROLE: Record<string, string[]> = {
  admin: ['start', 'stop', 'restart', 'emergency_stop', 'calibrate', 'diagnostics', 'reset_alerts'],
  engineer: ['start', 'stop', 'restart', 'calibrate', 'diagnostics', 'reset_alerts'],
  operator: ['start', 'stop', 'restart', 'emergency_stop'],
};

export const NodeDetailScreen: React.FC<{ route: any }> = ({ route }) => {
  const { nodeId } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { selectedNode } = useSelector((state: RootState) => state.nodes);
  const { user } = useSelector((state: RootState) => state.auth);
  const [commandType, setCommandType] = useState('');
  const [commandParam, setCommandParam] = useState('');
  const [nodeStatus, setNodeStatus] = useState<string>('online');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error' | 'info'>('info');

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  // Telemetry state
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const historyRef = useRef<Record<string, number[]>>({});
  const [chartData, setChartData] = useState<Record<string, number[]>>({});

  const isOffline = nodeStatus === 'offline';

  useEffect(() => {
    dispatch(fetchNodeById(nodeId));
    dispatch(fetchLatestTelemetry(nodeId)).then((action: any) => {
      if (action.payload) {
        setTelemetry(action.payload);
        const initial: Record<string, number[]> = {};
        action.payload.forEach((t: any) => {
          initial[t.param_id] = t.value !== null ? [t.value] : [];
        });
        historyRef.current = initial;
        setChartData({ ...initial });
      }
    });
  }, [nodeId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('subscribe:node', nodeId);

    const handleTelemetry = (data: any) => {
      if (data.node_id !== nodeId) return;
      setTelemetry(prev => prev.map(t =>
        t.param_id === data.param_id
          ? { ...t, value: data.value, timestamp: data.timestamp, quality_flag: data.quality_flag }
          : t
      ));
      const paramId = data.param_id;
      const history = historyRef.current[paramId] || [];
      const updated = [...history, data.value].slice(-CHART_POINTS);
      historyRef.current[paramId] = updated;
      setChartData(prev => ({ ...prev, [paramId]: updated }));
    };

    const handleStatus = (data: any) => {
      if (data.nodeId === nodeId) {
        setNodeStatus(data.status);
        // When node goes offline, clear live telemetry values
        if (data.status === 'offline') {
          setTelemetry(prev => prev.map(t => ({ ...t, value: null })));
        }
      }
    };

    socket.on('telemetry:update', handleTelemetry);
    socket.on('node:status', handleStatus);
    socket.on('nodes:statusUpdate', handleStatus);

    return () => {
      socket.emit('unsubscribe:node', nodeId);
      socket.off('telemetry:update', handleTelemetry);
      socket.off('node:status', handleStatus);
      socket.off('nodes:statusUpdate', handleStatus);
    };
  }, [nodeId]);

  useEffect(() => {
    if (selectedNode) setNodeStatus(selectedNode.status);
  }, [selectedNode?.status]);

  const sendCommand = useCallback(async (action?: string) => {
    const type = action || commandType.trim();
    if (!type) return;
    try {
      await http.post('/commands', {
        node_id: nodeId,
        action_type: type,
        parameters: commandParam ? JSON.parse(commandParam) : {},
      });
      if (!action) { setCommandType(''); setCommandParam(''); }
      const cmd = QUICK_COMMANDS.find(c => c.action === type);
      showModal('Команда отправлена', cmd ? `${cmd.description}: выполняется...` : `Команда "${type}" отправлена`, 'success');
    } catch (err: any) {
      showModal('Ошибка', err.response?.data?.error || 'Не удалось отправить команду', 'error');
    }
  }, [nodeId, commandType, commandParam]);

  const getValueColor = (t: any) => {
    if (t.value === null) return '#94a3b8';
    if (t.value < t.min_value || t.value > t.max_value) return '#ef4444';
    const range = t.max_value - t.min_value;
    if (t.value < t.min_value + range * 0.1 || t.value > t.max_value - range * 0.1) return '#f59e0b';
    return '#22c55e';
  };

  if (!selectedNode) return null;

  const canSendCommands = user?.role === 'engineer' || user?.role === 'admin' || user?.role === 'operator';
  const allowedCommands = COMMANDS_BY_ROLE[user?.role || ''] || [];
  const visibleCommands = QUICK_COMMANDS.filter(cmd => allowedCommands.includes(cmd.action));

  return (
    <ScrollView style={styles.container}>
      <Modal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />

      {/* Node header */}
      <Card>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nodeName}>{selectedNode.name}</Text>
            <Text style={styles.nodeInfo}>Тип: {selectedNode.type}</Text>
            <Text style={styles.nodeInfo}>IP: {selectedNode.ip_address}</Text>
          </View>
          <StatusBadge status={nodeStatus} size="md" />
        </View>
      </Card>

      {/* Offline banner */}
      {isOffline && (
        <Card>
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineIcon}>⏻</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTitle}>Узел остановлен</Text>
              <Text style={styles.offlineDesc}>Телеметрия недоступна. Отправьте команду "Старт" для запуска.</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Parameters with live charts */}
      <Text style={styles.sectionTitle}>Параметры {isOffline ? '(нет данных)' : '(real-time)'}</Text>

      {telemetry.map(item => {
        const color = isOffline ? '#cbd5e1' : getValueColor(item);
        const history = chartData[item.param_id] || [];
        return (
          <Card key={item.param_id}>
            <View style={[styles.paramRow, isOffline && { opacity: 0.4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paramName}>{item.name}</Text>
                <Text style={styles.paramRange}>
                  Диапазон: {item.min_value} — {item.max_value} {item.unit}
                </Text>
              </View>
              <View style={styles.valueBlock}>
                <Text style={[styles.paramValue, { color }]}>
                  {isOffline ? '—' : (item.value !== null ? item.value.toFixed(1) : '—')}
                </Text>
                <Text style={styles.paramUnit}>{item.unit}</Text>
              </View>
            </View>

            {/* Progress bar — only when online and has value */}
            {!isOffline && item.value !== null && (
              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, Math.max(0, ((item.value - item.min_value) / (item.max_value - item.min_value)) * 100))}%`,
                    backgroundColor: color,
                  },
                ]} />
              </View>
            )}

            {/* Sparkline chart — only when online */}
            {!isOffline && history.length > 1 && (
              <Sparkline
                data={history}
                min={item.min_value}
                max={item.max_value}
                color={color}
              />
            )}
          </Card>
        );
      })}

      {/* Commands section */}
      {canSendCommands && (
        <>
          <Text style={styles.sectionTitle}>Управление</Text>

          <View style={styles.quickRow}>
            {visibleCommands.map(cmd => {
              // Disable irrelevant commands based on state
              const disabled =
                (isOffline && (cmd.action === 'stop' || cmd.action === 'emergency_stop' || cmd.action === 'calibrate' || cmd.action === 'diagnostics')) ||
                (!isOffline && cmd.action === 'start');

              return (
                <TouchableOpacity
                  key={cmd.action}
                  style={[styles.quickBtn, { backgroundColor: disabled ? '#cbd5e1' : cmd.color }]}
                  onPress={() => !disabled && sendCommand(cmd.action)}
                  activeOpacity={disabled ? 1 : 0.7}
                >
                  <Text style={styles.quickLabel}>{cmd.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Card>
            <Text style={styles.customCmdTitle}>Произвольная команда</Text>
            <TextInput
              style={styles.input}
              placeholder="Тип команды"
              value={commandType}
              onChangeText={setCommandType}
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={styles.input}
              placeholder='Параметры JSON (опционально)'
              value={commandParam}
              onChangeText={setCommandParam}
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => sendCommand()} activeOpacity={0.7}>
              <Text style={styles.sendBtnText}>Отправить</Text>
            </TouchableOpacity>
          </Card>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  nodeName: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  nodeInfo: { fontSize: 13, color: '#64748b', marginTop: 2 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#1e293b', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 12,
  },
  offlineIcon: { fontSize: 28, color: '#ef4444' },
  offlineTitle: { fontSize: 15, fontWeight: '700', color: '#991b1b' },
  offlineDesc: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  paramRow: { flexDirection: 'row', alignItems: 'center' },
  paramName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  paramRange: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  valueBlock: { alignItems: 'flex-end' },
  paramValue: { fontSize: 24, fontWeight: '800' },
  paramUnit: { fontSize: 11, color: '#94a3b8' },
  progressBg: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  quickRow: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8,
  },
  quickBtn: {
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center', minWidth: 100,
  },
  quickLabel: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  customCmdTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10 },
  input: {
    backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, marginBottom: 10,
    color: '#1e293b', fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0',
  },
  sendBtn: {
    backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
