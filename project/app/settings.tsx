import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Trash2,
  ChevronRight,
  Mail,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={{ flex: 1 }}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Account Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.deleteItem}
            onPress={() => router.push('/delete-account')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.deleteIconWrap}>
                <Trash2 size={18} color={colors.dark.error} />
              </View>
              <Text style={styles.deleteItemText}>Delete Account</Text>
            </View>
            <ChevronRight size={18} color={colors.dark.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <View style={styles.contactRow}>
            <Mail size={16} color={colors.dark.textTertiary} />
            <Text style={styles.contactLabel}>Contact:</Text>
          </View>
          <Text style={styles.contactEmail}>support@coachingsolo.io</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deleteItem: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteItemText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
  },
  contactSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
    alignItems: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  contactLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
  },
  contactEmail: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark.textSecondary,
  },
});
