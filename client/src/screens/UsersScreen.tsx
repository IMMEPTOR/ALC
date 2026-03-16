import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import http from '../api/http';

interface UserItem {
  _id: string;
  username: string;
  is_active: boolean;
  role_id: { _id: string; name: string; permissions: string[] };
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444',
  engineer: '#3b82f6',
  operator: '#22c55e',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  engineer: 'Инженер',
  operator: 'Оператор',
};

export const UsersScreen: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'engineer' | 'operator'>('operator');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error' | 'info'>('info');

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await http.get('/users');
      setUsers(data);
    } catch {
      showModal('Ошибка', 'Не удалось загрузить пользователей', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, []);

  const createUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      showModal('Ошибка', 'Заполните логин и пароль', 'error');
      return;
    }
    try {
      await http.post('/users', { username: newUsername.trim(), password: newPassword, role_name: newRole });
      showModal('Успешно', `Пользователь "${newUsername}" создан`, 'success');
      setNewUsername('');
      setNewPassword('');
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      showModal('Ошибка', err.response?.data?.error || 'Не удалось создать', 'error');
    }
  };

  const toggleActive = async (user: UserItem) => {
    try {
      await http.put(`/users/${user._id}`, { is_active: !user.is_active });
      loadUsers();
    } catch (err: any) {
      showModal('Ошибка', err.response?.data?.error || 'Не удалось обновить', 'error');
    }
  };

  const deleteUser = async (user: UserItem) => {
    try {
      await http.delete(`/users/${user._id}`);
      showModal('Удалено', `Пользователь "${user.username}" удалён`, 'info');
      loadUsers();
    } catch (err: any) {
      showModal('Ошибка', err.response?.data?.error || 'Не удалось удалить', 'error');
    }
  };

  const changeRole = async (user: UserItem, roleName: string) => {
    try {
      await http.put(`/users/${user._id}`, { role_name: roleName });
      loadUsers();
    } catch (err: any) {
      showModal('Ошибка', err.response?.data?.error || 'Не удалось изменить роль', 'error');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Modal visible={modalVisible} title={modalTitle} message={modalMessage} type={modalType} onClose={() => setModalVisible(false)} />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Пользователи ({users.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>{showForm ? 'Отмена' : 'Добавить'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <Card>
          <Text style={styles.formTitle}>Новый пользователь</Text>
          <TextInput style={styles.input} placeholder="Логин" value={newUsername} onChangeText={setNewUsername} placeholderTextColor="#94a3b8" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Пароль" value={newPassword} onChangeText={setNewPassword} placeholderTextColor="#94a3b8" secureTextEntry />
          <Text style={styles.fieldLabel}>Роль</Text>
          <View style={styles.roleRow}>
            {(['operator', 'engineer', 'admin'] as const).map(role => (
              <TouchableOpacity
                key={role}
                style={[styles.roleOption, newRole === role && { backgroundColor: ROLE_COLORS[role] + '20', borderColor: ROLE_COLORS[role] }]}
                onPress={() => setNewRole(role)}
                activeOpacity={0.7}
              >
                <Text style={[styles.roleOptionText, newRole === role && { color: ROLE_COLORS[role] }]}>{ROLE_LABELS[role]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={createUser} activeOpacity={0.7}>
            <Text style={styles.createBtnText}>Создать</Text>
          </TouchableOpacity>
        </Card>
      )}

      {users.map(user => {
        const roleName = user.role_id?.name || 'unknown';
        const color = ROLE_COLORS[roleName] || '#64748b';
        return (
          <Card key={user._id}>
            <View style={styles.userRow}>
              <View style={[styles.userAvatar, { backgroundColor: color }]}>
                <Text style={styles.userAvatarText}>{user.username.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{user.username}</Text>
                  {!user.is_active && <View style={styles.inactiveBadge}><Text style={styles.inactiveText}>Деактивирован</Text></View>}
                </View>
                <View style={[styles.roleBadge, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.roleBadgeText, { color }]}>{ROLE_LABELS[roleName] || roleName}</Text>
                </View>
              </View>
            </View>

            {/* Role change */}
            <View style={styles.actionsSection}>
              <Text style={styles.actionsLabel}>Изменить роль:</Text>
              <View style={styles.roleRow}>
                {(['operator', 'engineer', 'admin'] as const).map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, roleName === role && { backgroundColor: ROLE_COLORS[role], borderColor: ROLE_COLORS[role] }]}
                    onPress={() => roleName !== role && changeRole(user, role)}
                    activeOpacity={roleName === role ? 1 : 0.7}
                  >
                    <Text style={[styles.roleChipText, roleName === role && { color: '#fff' }]}>{ROLE_LABELS[role]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: user.is_active ? '#f59e0b' : '#22c55e' }]} onPress={() => toggleActive(user)} activeOpacity={0.7}>
                <Text style={styles.actionBtnText}>{user.is_active ? 'Деактивировать' : 'Активировать'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => deleteUser(user)} activeOpacity={0.7}>
                <Text style={styles.actionBtnText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  addBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, marginBottom: 10, color: '#1e293b', fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleOption: { borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 14 },
  roleOptionText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  createBtn: { backgroundColor: '#22c55e', borderRadius: 8, padding: 14, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  inactiveBadge: { backgroundColor: '#fef2f2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveText: { fontSize: 10, fontWeight: '600', color: '#ef4444' },
  roleBadge: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  actionsSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionsLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  roleChip: { borderRadius: 6, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 12 },
  roleChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
