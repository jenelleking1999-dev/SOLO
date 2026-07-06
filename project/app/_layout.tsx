import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabaseConfigError } from '@/lib/supabase';
import { colors } from '@/constants/theme';

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `*::-webkit-scrollbar { display: none; } * { scrollbar-width: none; -ms-overflow-style: none; }`;
  document.head.appendChild(style);
}

SplashScreen.preventAutoHideAsync().catch(() => {
  // Non-fatal: the splash screen may already be hidden.
});

/**
 * Catches any unexpected render-time error anywhere in the app and shows a
 * recovery screen instead of crashing back to the phone's home screen.
 * expo-router automatically wraps the app with this export.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={fallbackStyles.container}>
      <Text style={fallbackStyles.title}>Something went wrong</Text>
      <Text style={fallbackStyles.message}>{error.message}</Text>
      <TouchableOpacity style={fallbackStyles.button} onPress={retry}>
        <Text style={fallbackStyles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Shown when the build is missing its Supabase credentials. */
function ConfigErrorScreen({ message }: { message: string }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={fallbackStyles.container}>
      <Text style={fallbackStyles.title}>Unable to start</Text>
      <Text style={fallbackStyles.message}>{message}</Text>
    </View>
  );
}

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050014',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

function PasswordRecoveryHandler({ children }: { children: React.ReactNode }) {
  const { isPasswordRecovery, clearPasswordRecovery, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'waiting' | 'redirecting' | 'ready'>('waiting');
  const hasRedirected = useRef(false);

  // Check for error hashes synchronously on mount
  const [hashError] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('error=') && hash.includes('error_description=')) {
        const params = new URLSearchParams(hash.substring(1));
        const errorCode = params.get('error_code') || '';
        const errorDesc = params.get('error_description') || '';
        if (errorCode === 'otp_expired' || errorDesc.includes('expired')) {
          return 'expired';
        }
      }
    }
    return null;
  });

  useEffect(() => {
    if (hasRedirected.current) return;

    if (hashError === 'expired') {
      hasRedirected.current = true;
      router.replace('/update-password?expired=true');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setStatus('redirecting');
      return;
    }

    if (isPasswordRecovery) {
      hasRedirected.current = true;
      clearPasswordRecovery();
      router.replace('/update-password');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setStatus('redirecting');
      return;
    }

    if (!loading) {
      setStatus('ready');
    }
  }, [isPasswordRecovery, loading, hashError]);

  // Safety: if recovery event fires late (after initial render), still redirect
  useEffect(() => {
    if (isPasswordRecovery && !hasRedirected.current) {
      hasRedirected.current = true;
      clearPasswordRecovery();
      router.replace('/update-password');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setStatus('redirecting');
    }
  }, [isPasswordRecovery]);

  if (status === 'waiting' || status === 'redirecting') {
    return (
      <View style={recoveryStyles.container}>
        <ActivityIndicator size="large" color={colors.dark.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

const recoveryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // A build without server credentials must show a message, never crash.
  if (supabaseConfigError) {
    return <ConfigErrorScreen message={supabaseConfigError} />;
  }

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <PasswordRecoveryHandler>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="update-password" />
          <Stack.Screen name="delete-account" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="results" />
          <Stack.Screen name="athlete-history" />
          <Stack.Screen name="manage-athletes" />
          <Stack.Screen name="workout-history" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />
      </PasswordRecoveryHandler>
    </AuthProvider>
  );
}
