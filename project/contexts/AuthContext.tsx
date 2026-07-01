import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
      email.trim().toLowerCase()
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
