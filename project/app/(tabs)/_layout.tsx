import { Tabs } from 'expo-router';
import { House as Home, User, ChartBar } from 'lucide-react-native';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.dark.background,
          borderTopColor: colors.dark.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.dark.primary,
        tabBarInactiveTintColor: colors.dark.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarIcon: ({ size, color }) => <ChartBar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
