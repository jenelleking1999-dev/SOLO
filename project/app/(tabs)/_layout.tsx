import { Tabs } from 'expo-router';
import { House as Home, User, ChartBar } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user, isCoach } = useAuth();
  // Results shows the coach's live session results; athletes and parents see
  // their times from the Home screen instead.
  const showResults = !user || isCoach;

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
          href: showResults ? undefined : null,
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
          // Hide the tab bar during a workout so the only way out is the
          // guarded back button (which warns and pauses the workout).
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
