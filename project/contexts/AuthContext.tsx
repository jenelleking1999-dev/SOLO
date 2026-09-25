import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Where Supabase sends the user after they tap a link in a verification or
 * password-reset email. On native this deep-links back into the app (handled
 * by `handleAuthDeepLink` below and the `app/auth-callback.tsx` route). Must be
 * listed under Authentication → URL Configuration → Redirect URLs in BOTH
 * Supabase projects, or Supabase falls back to the project's Site URL.
 */
function getAuthRedirectUrl(): string | undefined {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.location ? window.location.origin : undefined;
  }
  return 'coachingsolo://auth-callback';
}

/** Reads auth params from both the #fragment (implicit flow) and ?query of a deep link. */
function parseAuthParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => params.set(key, value));
  }
  return params;
}

function detectRecoveryInHash(): boolean {
  // `window` exists on native but `window.location` may be undefined there, so
  // guard both before touching `.hash` (web-only password-recovery deep links).
  if (
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.hash === 'string'
  ) {
    return window.location.hash.includes('type=recovery');
  }
  return false;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(detectRecoveryInHash);
  const expectingRecoveryEvent = useRef(detectRecoveryInHash());

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'PASSWORD_RECOVERY') {
          expectingRecoveryEvent.current = false;
          setIsPasswordRecovery(true);
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }

        // If we're expecting a PASSWORD_RECOVERY event (hash had type=recovery),
        // do NOT finalize loading on SIGNED_IN — wait for the recovery event
        if (expectingRecoveryEvent.current && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
      })();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Only set loading=false if we're NOT waiting for a recovery event
      if (!expectingRecoveryEvent.current) {
        setLoading(false);
      }
    });

    // Safety timeout: if recovery event never fires within 5s, unblock anyway
    if (expectingRecoveryEvent.current) {
      const timeout = setTimeout(() => {
        if (expectingRecoveryEvent.current) {
          expectingRecoveryEvent.current = false;
          setIsPasswordRecovery(true);
          setLoading(false);
        }
      }, 5000);
      return () => {
        timeout && clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, []);

  // Native only: finish sign-in when the app is opened from an email link
  // (coachingsolo://auth-callback#access_token=...&type=signup|recovery).
  const handledAuthUrls = useRef(new Set<string>());
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAuthDeepLink = async (url: string | null) => {
      if (!url || !url.includes('auth-callback') || handledAuthUrls.current.has(url)) return;
      handledAuthUrls.current.add(url);

      const params = parseAuthParams(url);
      if (params.get('error')) {
        Alert.alert(
          'Link expired',
          'This email link has expired or was already used. Try signing in, or request a new link.'
        );
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return;

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) return;

      if (params.get('type') === 'recovery') {
        setIsPasswordRecovery(true);
      }
    };

    Linking.getInitialURL().then(handleAuthDeepLink);
    const linkSubscription = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url));
    return () => linkSubscription.remove();
  }, []);

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    if (error) throw error;

    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    if (data.user && fullName) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
      } as any);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: getAuthRedirectUrl() }
    );
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isPasswordRecovery,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        clearPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
