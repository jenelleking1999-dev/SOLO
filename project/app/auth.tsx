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
import { ArrowLeft, SquareCheck as CheckSquare, Square } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

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
        await signUp(email, password, fullName);
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
              ? 'Sign up to save your workouts'
              : 'Sign in to continue'}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
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
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSignUp && !agreedToTerms) && styles.submitButtonDisabled,
            ]}
            onPress={handleAuth}
            disabled={loading || (isSignUp && !agreedToTerms)}
          >
            <LinearGradient
              colors={
                (isSignUp && !agreedToTerms)
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
