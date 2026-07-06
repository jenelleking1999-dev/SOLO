import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * If the build is missing its Supabase credentials, DO NOT throw at module
 * load — that crashes the app at the splash screen before anything renders.
 * Instead we create a placeholder client and expose the problem via
 * `supabaseConfigError` so the root layout can show a readable error screen.
 */
export const supabaseConfigError: string | null =
  !supabaseUrl || !supabaseAnonKey
    ? 'This build is missing its server configuration (Supabase URL / key). Please reinstall or update the app.'
    : null;

const isWeb = Platform.OS === 'web';

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // On native, persist the session in AsyncStorage so the user stays signed
      // in across app restarts. On web, fall back to the default (localStorage).
      storage: isWeb ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // URL-based session detection is a web-only concept (magic links / password
      // recovery hashes); enabling it on native has no URL to read.
      detectSessionInUrl: isWeb,
    },
  }
);
