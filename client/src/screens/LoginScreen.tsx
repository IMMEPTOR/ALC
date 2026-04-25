import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';

const CLIENT_INFO = Platform.OS === 'web'
  ? { label: 'Веб-клиент', role: 'Для инженеров' }
  : { label: 'Мобильный клиент', role: 'Для операторов' };

export const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const handleLogin = () => {
    if (username.trim() && password.trim()) {
      dispatch(login({ username: username.trim(), password }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>ALC</Text>
        <Text style={styles.subtitle}>Assembly Line Control</Text>
        <View style={styles.clientBadge}>
          <Text style={styles.clientLabel}>{CLIENT_INFO.label}</Text>
          <Text style={styles.clientRole}>{CLIENT_INFO.role}</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Имя пользователя"
          value={username}
          onChangeText={(t) => { setUsername(t); if (error) dispatch(clearError()); }}
          autoCapitalize="none"
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          value={password}
          onChangeText={(t) => { setPassword(t); if (error) dispatch(clearError()); }}
          secureTextEntry
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16, padding: 32, width: '100%', maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 36, fontWeight: '800', color: '#3b82f6', textAlign: 'center', marginBottom: 4,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 32,
  },
  input: {
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 14,
    color: '#e2e8f0', fontSize: 16, borderWidth: 1, borderColor: '#334155',
  },
  button: {
    backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: {
    backgroundColor: '#ef4444' + '20', borderRadius: 8, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#ef4444',
  },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  clientBadge: { alignItems: 'center', marginBottom: 24, backgroundColor: '#0f172a', borderRadius: 8, padding: 10 },
  clientLabel: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  clientRole: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
