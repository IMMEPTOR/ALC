import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { NodeDetailScreen } from '../screens/NodeDetailScreen';
import { AlertsScreen } from '../screens/AlertsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ManagementScreen } from '../screens/ManagementScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const isWeb = Platform.OS === 'web';

// Mobile tabs: operator — monitoring, alerts, commands, profile
// Web tabs: engineer — monitoring, alerts, management (CRUD), profile
const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarIconStyle: { display: 'none' },
        tabBarItemStyle: { paddingVertical: 8 },
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#e2e8f0',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Мониторинг' }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ title: 'Алармы' }}
      />
      {isWeb && (
        <Tab.Screen
          name="Management"
          component={ManagementScreen}
          options={{ title: 'Управление' }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Профиль' }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="NodeDetail"
            component={NodeDetailScreen}
            options={({ route }: any) => ({
              headerShown: true,
              title: route.params?.title || 'Узел',
              headerStyle: { backgroundColor: '#0f172a' },
              headerTintColor: '#e2e8f0',
              headerTitleStyle: { fontWeight: '700' },
            })}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
