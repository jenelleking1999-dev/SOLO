import { Redirect } from 'expo-router';

/**
 * Landing route for links in Supabase verification / password-reset emails
 * (coachingsolo://auth-callback#...). AuthContext reads the tokens from the
 * URL and signs the user in; this screen just sends them to the home screen.
 * A password-reset link is then redirected to /update-password by
 * PasswordRecoveryHandler in app/_layout.tsx.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
