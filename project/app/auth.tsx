import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeft,
  SquareCheck as CheckSquare,
  Square,
  Timer,
  PersonStanding,
  Users,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { AccountRole } from '@/types/database';

const ROLE_OPTIONS: {
  role: AccountRole;
  label: string;
  description: string;
  Icon: typeof Timer;
}[] = [
  { role: 'coach', label: 'Coach', description: 'Run workouts and record times', Icon: Timer },
  { role: 'athlete', label: 'Athlete', description: 'View your times from your coach', Icon: PersonStanding },
  { role: 'parent', label: 'Parent', description: "View your child's times", Icon: Users },
];

const TERMS_URL = 'https://sites.google.com/coachingsolo.io/solo/terms-conditions?authuser=0';
const PRIVACY_URL = 'https://sites.google.com/coachingsolo.io/solo/privacy-policy?authuser=0';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [accountRole, setAccountRole] = useState<AccountRole | null>(null);
  const [confirmedAge, setConfirmedAge] = useState(false);
  // Athletes under 13 must be added through a parent account instead.
  const needsAgeConfirmation = accountRole === 'athlete';
  const canSubmitSignUp =
    agreedToTerms && accountRole !== null && (!needsAgeConfirmation || confirmedAge);
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (!accountRole) {
          setError('Choose whether you are a coach, athlete or parent');
          return;
        }
        await signUp(email, password, fullName, accountRole);
      } else {
        await signIn(email, password);
      }
      goBack();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
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
          <TouchableOpacity onPress={() => goBack()}>
            <ArrowLeft size={24} color={colors.dark.text} />
          </TouchableOpacity>
        </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/solo_logo-removebg-preview.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>SOLO</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.formSubtitle}>
            {isSignUp
              ? 'Create your SOLO account'
              : 'Sign in to continue'}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isSignUp && (
            <View style={styles.roleSection}>
              <Text style={styles.roleQuestion}>I am a…</Text>
              {ROLE_OPTIONS.map(({ role: option, label, description, Icon }) => {
                const selected = accountRole === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.roleOption, selected && styles.roleOptionSelected]}
                    onPress={() => {
                      setAccountRole(option);
                      setError('');
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Icon size={22} color={selected ? '#ffffff' : colors.dark.primaryLight} />
                    <View style={styles.roleTextWrap}>
                      <Text style={styles.roleLabel}>{label}</Text>
                      <Text style={styles.roleDescription}>{description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {accountRole && accountRole !== 'coach' && (
                <Text style={styles.roleHint}>
                  After signing up, enter the invite code from your coach to see{' '}
                  {accountRole === 'parent' ? "your child's" : 'your'} times.
                </Text>
              )}
            </View>
          )}

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.dark.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.dark.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.dark.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {!isSignUp && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {isSignUp && (
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
              >
                {agreedToTerms ? (
                  <CheckSquare size={20} color={colors.dark.primary} />
                ) : (
                  <Square size={20} color={colors.dark.textSecondary} />
                )}
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
                  >
                    Terms & Services
                  </Text>
                  {' '}and acknowledge the{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>
              {needsAgeConfirmation && (
                <TouchableOpacity
                  style={[styles.checkboxRow, styles.ageRow]}
                  onPress={() => setConfirmedAge(!confirmedAge)}
                  activeOpacity={0.7}
                >
                  {confirmedAge ? (
                    <CheckSquare size={20} color={colors.dark.primary} />
                  ) : (
                    <Square size={20} color={colors.dark.textSecondary} />
                  )}
                  <Text style={styles.termsText}>
                    I am 13 or older. (Under 13? Ask a parent to create a Parent account instead.)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSignUp && !canSubmitSignUp) && styles.submitButtonDisabled,
            ]}
            onPress={handleAuth}
            disabled={loading || (isSignUp && !canSubmitSignUp)}
          >
            <LinearGradient
              colors={
                (isSignUp && !canSubmitSignUp)
                  ? [colors.dark.textTertiary, colors.dark.textTertiary]
                  : [colors.dark.primary, colors.dark.secondary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>
                {loading
                  ? 'Please wait...'
                  : isSignUp
                    ? 'Create Account'
                    : 'Sign In'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
          >
            <Text style={styles.switchButtonText}>
              {isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </Text>
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
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.display,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#a5b4fc',
  },
  formContainer: {
    marginTop: spacing.lg,
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
  },
  errorContainer: {
    backgroundColor: colors.dark.error,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.dark.text,
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
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
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
  submitButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
    marginTop: -spacing.sm,
  },
  forgotPasswordText: {
    color: colors.dark.primaryLight,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  termsContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  termsText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.dark.primaryLight,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    textDecorationLine: 'underline',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  roleSection: {
    marginBottom: spacing.md,
  },
  roleQuestion: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
    marginBottom: spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginBottom: spacing.sm,
  },
  roleOptionSelected: {
    borderColor: colors.dark.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  roleTextWrap: {
    flex: 1,
  },
  roleLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  roleDescription: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  roleHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: spacing.xs,
  },
  ageRow: {
    marginTop: spacing.sm,
  },
  switchButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  switchButtonText: {
    color: colors.dark.textSecondary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
});
