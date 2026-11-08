import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronRight, KeyRound, UserX } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LinkedAthlete } from '@/types/database';
import { getMyLinkedAthletes, redeemInviteCode, removeAthleteLink } from '@/lib/athleteAccess';

/**
 * Home screen for athlete and parent accounts: connect with a coach's invite
 * code, then open an athlete to see the times the coach recorded.
 */
export function ViewerHome() {
  const router = useRouter();
  const { role } = useAuth();
  const isParent = role === 'parent';

  const [athletes, setAthletes] = useState<LinkedAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [codeMessage, setCodeMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<LinkedAthlete | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAthletes(await getMyLinkedAthletes());
      setLoadError(null);
    } catch (error: any) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleConnect = async () => {
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 8) {
      setCodeMessage({ text: 'Enter the 8-character code from your coach.', isError: true });
      return;
    }
    setConnecting(true);
    setCodeMessage(null);
    try {
      const result = await redeemInviteCode(code);
      setCode('');
      setCodeMessage({
        text: `Connected to ${result.athlete_name} (${result.coach_name}).`,
        isError: false,
      });
      await load();
    } catch (error: any) {
      setCodeMessage({ text: error.message, isError: true });
    } finally {
      setConnecting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    try {
      await removeAthleteLink(target.link_id);
      setAthletes((prev) => prev.filter((a) => a.link_id !== target.link_id));
    } catch (error: any) {
      setLoadError(error.message);
    }
  };

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.dark.primary} />
        }
      >
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/solo_logo-removebg-preview.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>SOLO</Text>
          <Text style={styles.tagline}>{isParent ? "Your athletes' times" : 'Your times'}</Text>
        </View>

        <Text style={styles.sectionTitle}>{isParent ? 'Your athletes' : 'Your coaches'}</Text>

        {loading && athletes.length === 0 ? (
          <ActivityIndicator color={colors.dark.primary} style={styles.loader} />
        ) : loadError ? (
          <TouchableOpacity onPress={load}>
            <Text style={styles.errorText}>{loadError} Tap to retry.</Text>
          </TouchableOpacity>
        ) : athletes.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              {isParent
                ? "No athletes connected yet. Ask your child's coach for a parent invite code and enter it below."
                : 'Not connected to a coach yet. Ask your coach for an athlete invite code and enter it below.'}
            </Text>
          </View>
        ) : (
          athletes.map((athlete) => (
            <View key={athlete.link_id} style={styles.athleteRow}>
              <TouchableOpacity
                style={styles.athleteMain}
                onPress={() =>
                  router.push({
                    pathname: '/athlete-history',
                    params: { athleteName: athlete.athlete_name, linkId: athlete.link_id },
                  })
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{athlete.athlete_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.athleteText}>
                  <Text style={styles.athleteName}>{athlete.athlete_name}</Text>
                  <Text style={styles.athleteSub}>Coach: {athlete.coach_name}</Text>
                </View>
                <ChevronRight size={20} color={colors.dark.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setRemoveTarget(athlete)}
                accessibilityLabel={`Disconnect from ${athlete.athlete_name}`}
              >
                <UserX size={18} color={colors.dark.textTertiary} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={[styles.card, styles.connectCard]}>
          <View style={styles.connectHeader}>
            <KeyRound size={18} color={colors.dark.accent} />
            <Text style={styles.connectTitle}>
              {athletes.length > 0
                ? isParent
                  ? 'Add another athlete'
                  : 'Connect another coach'
                : 'Enter an invite code'}
            </Text>
          </View>
          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              placeholder="ABCD-EFGH"
              placeholderTextColor={colors.dark.textTertiary}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              onSubmitEditing={handleConnect}
            />
            <TouchableOpacity
              style={[styles.connectButton, connecting && styles.connectButtonDisabled]}
              onPress={handleConnect}
              disabled={connecting}
            >
              <Text style={styles.connectButtonText}>{connecting ? '...' : 'Connect'}</Text>
            </TouchableOpacity>
          </View>
          {codeMessage && (
            <Text style={codeMessage.isError ? styles.errorText : styles.successText}>
              {codeMessage.text}
            </Text>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={!!removeTarget}
        title="Disconnect?"
        message={
          removeTarget
            ? `You will no longer see ${removeTarget.athlete_name}'s times. You'll need a new code from the coach to reconnect.`
            : ''
        }
        confirmLabel="Disconnect"
        destructive
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.sm,
  },
  logoText: {
    fontSize: 36,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
    marginBottom: spacing.md,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  card: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    lineHeight: 20,
  },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  athleteMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  athleteText: {
    flex: 1,
  },
  athleteName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  athleteSub: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.md,
  },
  connectCard: {
    marginTop: spacing.md,
  },
  connectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  connectTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  codeInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.dark.text,
    letterSpacing: 2,
  },
  connectButton: {
    backgroundColor: colors.dark.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
    marginTop: spacing.sm,
  },
  successText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.success,
    marginTop: spacing.sm,
  },
});
