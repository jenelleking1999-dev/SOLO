import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Lock, Eye, EyeOff, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Clock } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least 1 uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least 1 lowercase letter', met: /[a-z]/.test(password) },
    { label: 'At least 1 number', met: /[0-9]/.test(password) },
  ];
}

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const { updatePassword, signOut, session } = useAuth();

  const isExpired = expired === 'true';

  useEffect(() => {
    if (success) {
      const timer = setTimeout(async () => {
        try { await signOut(); } catch (_) {}
        router.replace('/auth');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (isExpired) {
    return (
      <LinearGradient
        colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
        style={{ flex: 1 }}
      >
        <View style={styles.successScreen}>
          <View style={styles.expiredIconWrapper}>
            <Clock size={56} color={colors.dark.warning} />
          </View>
          <Text style={styles.successTitle}>Link Expired</Text>
          <Text style={styles.successMessage}>
            This password reset link has expired or is no longer valid.
          </Text>
          <Text style={styles.successNote}>
            Reset links expire after a short time for security. Please request a new one.
          </Text>
          <TouchableOpacity
            style={styles.goToLoginButton}
            onPress={() => router.replace('/forgot-password')}
          >
            <LinearGradient
              colors={[colors.dark.primary, colors.dark.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goToLoginGradient}
            >
              <Text style={styles.goToLoginText}>Request New Link</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: spacing.lg }}
            onPress={() => router.replace('/auth')}
          >
            <Text style={styles.backToLoginLink}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const requirements = getPasswordRequirements(password);
  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allRequirementsMet && passwordsMatch && !loading;

  const handleUpdatePassword = async () => {
    setError('');

    if (!allRequirementsMet) {
      setError('Please meet all password requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    if (!session) {
      setError('Your reset link has expired or is invalid. Please request a new one.');
      console.error('SECURITY BLOCK: Password update attempt without valid session');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (err: any) {
      if (err.message?.includes('expired') || err.message?.includes('invalid')) {
        setError('Your reset link has expired. Please request a new one.');
      } else {
        setError('Failed to update password. Please try again.');
      }
      console.error('SECURITY LOG: Password update failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <LinearGradient
        colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
        style={{ flex: 1 }}
      >
        <View style={styles.successScreen}>
          <View style={styles.successIconWrapper}>
            <CheckCircle size={56} color={colors.dark.success} />
          </View>
          <Text style={styles.successTitle}>Password Updated</Text>
          <Text style={styles.successMessage}>
            Your password has been successfully updated.
          </Text>
          <Text style={styles.successNote}>
            Redirecting to sign in...
          </Text>
          <TouchableOpacity
            style={styles.goToLoginButton}
            onPress={() => router.replace('/auth')}
          >
            <LinearGradient
              colors={[colors.dark.primary, colors.dark.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goToLoginGradient}
            >
              <Text style={styles.goToLoginText}>Go to Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <View style={styles.iconWrapper}>
              <Lock size={40} color={colors.dark.primaryLight} />
            </View>
            <Text style={styles.formTitle}>Create New Password</Text>
            <Text style={styles.formSubtitle}>
              Enter your new password below. Make sure it meets all the requirements.
            </Text>

            {error !== '' && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color={colors.dark.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="New password"
                placeholderTextColor={colors.dark.textTertiary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.dark.textTertiary} />
                ) : (
                  <Eye size={20} color={colors.dark.textTertiary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor={colors.dark.textTertiary}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (error) setError('');
                }}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? (
                  <EyeOff size={20} color={colors.dark.textTertiary} />
                ) : (
                  <Eye size={20} color={colors.dark.textTertiary} />
                )}
              </TouchableOpacity>
            </View>

            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.mismatchText}>Passwords do not match</Text>
            )}

            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>Password Requirements</Text>
              {requirements.map((req) => (
                <View key={req.label} style={styles.requirementRow}>
                  <CheckCircle
                    size={16}
                    color={req.met ? colors.dark.success : colors.dark.textTertiary}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      req.met && styles.requirementMet,
                    ]}
                  >
                    {req.label}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleUpdatePassword}
              disabled={!canSubmit}
            >
              <LinearGradient
                colors={canSubmit
                  ? [colors.dark.primary, colors.dark.secondary]
                  : [colors.dark.textTertiary, colors.dark.textTertiary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Update Password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
  },
  formContainer: {
    marginTop: spacing.lg,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.dark.error,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.dark.error,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.md,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.md,
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  eyeButton: {
    padding: spacing.md,
  },
  mismatchText: {
    color: colors.dark.error,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  requirementsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  requirementsTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    marginBottom: spacing.sm,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  requirementText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
  },
  requirementMet: {
    color: colors.dark.success,
  },
  submitButton: {
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
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  successIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: spacing.md,
  },
  successMessage: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  successNote: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  goToLoginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
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
  goToLoginGradient: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goToLoginText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  expiredIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  backToLoginLink: {
    color: colors.dark.textSecondary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
});
