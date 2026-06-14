import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, CircleCheck as CheckCircle } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { resetPassword } = useAuth();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/auth');
    }
  };

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value.trim());
  };

  const handleSendReset = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      const message = err?.message ?? '';
      if (message.includes('rate') || message.includes('limit') || message.includes('too many')) {
        setError('Too many reset requests. Please wait a few minutes and try again.');
      } else if (message.includes('network') || message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setSent(true);
      }
      console.error('Password reset error:', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.dark.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {sent ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconWrapper}>
                <CheckCircle size={56} color={colors.dark.success} />
              </View>
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successMessage}>
                If an account exists for this email, a password reset link has been sent.
              </Text>
              <Text style={styles.successNote}>
                Please check your inbox and spam folder. The link will expire in 1 hour.
              </Text>
              <TouchableOpacity style={styles.backToLoginButton} onPress={goBack}>
                <LinearGradient
                  colors={[colors.dark.primary, colors.dark.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.backToLoginGradient}
                >
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.iconWrapper}>
                <Mail size={40} color={colors.dark.primaryLight} />
              </View>
              <Text style={styles.formTitle}>Reset Password</Text>
              <Text style={styles.formSubtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              {error !== '' && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={colors.dark.textTertiary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSendReset}
                disabled={loading}
              >
                <LinearGradient
                  colors={loading
                    ? [colors.dark.textTertiary, colors.dark.textTertiary]
                    : [colors.dark.primary, colors.dark.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Send Reset Link</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={goBack}>
                <Text style={styles.cancelButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  backButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
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
  },
  input: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
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
  cancelButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.dark.textSecondary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
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
    paddingHorizontal: spacing.md,
  },
  successNote: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  backToLoginButton: {
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
  backToLoginGradient: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToLoginText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
});
