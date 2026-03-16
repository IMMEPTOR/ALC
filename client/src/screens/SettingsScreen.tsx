import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { Card } from '../components/Card';

const ROLE_META: Record<string, { title: string; description: string; color: string }> = {
  admin: {
    title: 'Администратор',
    description: 'Полный доступ к системе: управление пользователями, конфигурация системы, все операции с данными.',
    color: '#ef4444',
  },
  engineer: {
    title: 'Инженер',
    description: 'Управление техническими узлами, настройка параметров, разрешение тревог и аналитика.',
    color: '#3b82f6',
  },
  operator: {
    title: 'Оператор',
    description: 'Мониторинг показаний, отправка команд управления, подтверждение тревог.',
    color: '#22c55e',
  },
};

const PERMISSION_META: Record<string, { label: string; description: string }> = {
  read: { label: 'Чтение', description: 'Просмотр данных телеметрии, узлов, тревог' },
  write: { label: 'Запись', description: 'Создание и изменение данных, отправка команд' },
  delete: { label: 'Удаление', description: 'Удаление записей, пользователей, данных' },
  manage_users: { label: 'Управление пользователями', description: 'Создание, редактирование и удаление аккаунтов' },
  manage_system: { label: 'Управление системой', description: 'Настройка серверов, производственных площадок, линий' },
  manage_nodes: { label: 'Управление узлами', description: 'Настройка параметров узлов, калибровка, диагностика' },
  resolve_alerts: { label: 'Разрешение тревог', description: 'Перевод тревог в статус "Разрешено"' },
  acknowledge_alerts: { label: 'Подтверждение тревог', description: 'Подтверждение (acknowledge) активных тревог' },
  send_commands: { label: 'Отправка команд', description: 'Старт, стоп, рестарт узлов и оборудования' },
};

const COMMANDS_BY_ROLE: Record<string, string[]> = {
  admin: ['start', 'stop', 'restart', 'emergency_stop', 'calibrate', 'diagnostics', 'set_parameter', 'reset_alerts'],
  engineer: ['start', 'stop', 'restart', 'calibrate', 'diagnostics', 'set_parameter', 'reset_alerts'],
  operator: ['start', 'stop', 'restart', 'emergency_stop'],
};

const COMMAND_META: Record<string, { label: string; description: string }> = {
  start: { label: 'Старт', description: 'Запуск остановленного узла' },
  stop: { label: 'Стоп', description: 'Плановая остановка узла' },
  restart: { label: 'Рестарт', description: 'Перезагрузка узла (offline → online)' },
  emergency_stop: { label: 'Аварийный стоп', description: 'Экстренная остановка, требует ручного запуска' },
  calibrate: { label: 'Калибровка', description: 'Калибровка датчиков узла' },
  diagnostics: { label: 'Диагностика', description: 'Запуск проверки состояния оборудования' },
  set_parameter: { label: 'Изменить параметр', description: 'Изменение min/max параметров узла' },
  reset_alerts: { label: 'Сброс алармов', description: 'Сброс всех активных тревог узла' },
};

export const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const roleMeta = ROLE_META[user?.role || ''] || ROLE_META.operator;
  const commands = COMMANDS_BY_ROLE[user?.role || ''] || [];

  return (
    <ScrollView style={styles.container}>
      {/* Profile header */}
      <View style={[styles.profileCard, { borderLeftColor: roleMeta.color }]}>
        <View style={[styles.avatar, { backgroundColor: roleMeta.color }]}>
          <Text style={styles.avatarText}>{user?.username?.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.username}>{user?.username}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleMeta.color + '20' }]}>
            <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>{roleMeta.title}</Text>
          </View>
          <Text style={styles.roleDesc}>{roleMeta.description}</Text>
        </View>
      </View>

      {/* Permissions */}
      <Text style={styles.sectionTitle}>Разрешения</Text>
      <Card>
        {(user?.permissions || []).map((perm: string, idx: number) => {
          const meta = PERMISSION_META[perm] || { label: perm, description: '' };
          return (
            <View key={perm} style={[styles.permRow, idx > 0 && styles.permRowBorder]}>
              <View style={[styles.permDot, { backgroundColor: roleMeta.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.permLabel}>{meta.label}</Text>
                <Text style={styles.permDesc}>{meta.description}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      {/* Available commands */}
      <Text style={styles.sectionTitle}>Доступные команды</Text>
      <Card>
        {commands.map((cmd, idx) => {
          const meta = COMMAND_META[cmd] || { label: cmd, description: '' };
          return (
            <View key={cmd} style={[styles.permRow, idx > 0 && styles.permRowBorder]}>
              <View style={[styles.cmdDot, { backgroundColor: '#64748b' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.permLabel}>{meta.label}</Text>
                <Text style={styles.permDesc}>{meta.description}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      {/* System info */}
      <Text style={styles.sectionTitle}>О системе</Text>
      <Card>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Система</Text>
          <Text style={styles.infoValue}>ALC — Assembly Line Control</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Версия</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </Card>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Выйти из системы</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  username: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  roleBadge: {
    alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },
  roleDesc: { fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 18 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#64748b', paddingTop: 16, paddingBottom: 8,
  },
  permRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10,
  },
  permRowBorder: {
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  permDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 5,
  },
  cmdDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 5,
  },
  permLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  permDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  logoutBtn: {
    backgroundColor: '#ef4444', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20,
  },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
