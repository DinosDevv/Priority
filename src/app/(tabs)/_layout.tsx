import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#f1f5f9',
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: '#020617', borderTopColor: '#1e293b' },
        tabBarActiveTintColor: '#f1f5f9',
        tabBarInactiveTintColor: '#64748b',
        sceneStyle: { backgroundColor: '#020617' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Log', tabBarIcon: icon('add-circle') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="week" options={{ title: 'Week', tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="areas" options={{ title: 'Areas', tabBarIcon: icon('grid') }} />
    </Tabs>
  );
}
