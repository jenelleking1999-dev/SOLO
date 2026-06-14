import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LogOut, User, Clock, Users, ChevronRight, Settings, FileText, Shield } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <LinearGradient
        colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.notAuthContainer}>
          <User size={64} color={colors.dark.textSecondary} />
          <Text style={styles.notAuthTitle}>Not Signed In</Text>
          <Text style={styles.notAuthText}>
            Sign in to save workouts, track progress, and manage athletes
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/auth')}
          >
            <LinearGradient
              colors={[colors.dark.primary, colors.dark.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signInButtonGradient}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <User size={48} color={colors.dark.text} />
          </View>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/workout-history')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <Clock size={18} color={colors.dark.primary} />
              </View>
              <Text style={styles.menuItemText}>Workout History</Text>
            </View>
            <ChevronRight size={18} color={colors.dark.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/manage-athletes')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <Users size={18} color={colors.dark.primary} />
              </View>
              <Text style={styles.menuItemText}>Manage Athletes</Text>
            </View>
            <ChevronRight size={18} color={colors.dark.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/settings')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <Settings size={18} color={colors.dark.primary} />
              </View>
              <Text style={styles.menuItemText}>Settings</Text>
            </View>
            <ChevronRight size={18} color={colors.dark.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => WebBrowser.openBrowserAsync('https://sites.google.com/coachingsolo.io/solo/terms-conditions?authuser=0')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <FileText size={18} color={colors.dark.primary} />
              </View>
              <Text style={styles.menuItemText}>Terms & Services</Text>
            </View>
            <ChevronRight size={18} color={colors.dark.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => WebBrowser.openBrowserAsync('https://sites.google.com/coachingsolo.io/solo/privacy-policy?authuser=0')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconWrap}>
                <Shield size={18} color={colors.dark.primary} />
              </View>
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <ChevronRight size={18} color={colors.dark.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={loading}
        >
          <LogOut size={20} color={colors.dark.error} />
          <Text style={styles.signOutButtonText}>
            {loading ? 'Signing out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  title: {
    fontSize: typography.fontSize.xxxl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  notAuthContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  notAuthTitle: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  notAuthText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  signInButton: {
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  signInButtonGradient: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  profileCard: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  email: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    marginBottom: spacing.md,
  },
  menuItem: {
    backgroundColor: colors.dark.cardGlass,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dark.error,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  signOutButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.error,
  },
});
