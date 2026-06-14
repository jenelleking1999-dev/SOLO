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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  TriangleAlert as AlertTriangle,
  Eye,
  EyeOff,
  CircleCheck as CheckCircle,
  Trash2,
  ShieldAlert,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function DeleteAccountScreen() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { user, signOut } = useAuth();

  const canProceed = password.length >= 6 && confirmed;

  const handleDeleteRequest = () => {
    setError('');
    if (!canProceed) return;
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    setShowModal(false);
    setLoading(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setError('Your session has expired. Please sign in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ password }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError('Incorrect password. Please try again.');
        } else if (response.status === 401) {
          setError('Your session has expired. Please sign in and try again.');
        } else {
          setError(result.error || 'Failed to delete account. Please try again.');
        }
        setLoading(false);
        return;
      }

      setSuccess(true);

      setTimeout(async () => {
        try { await signOut(); } catch (_) {}
        router.replace('/auth');
      }, 3000);
    } catch (err: any) {
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
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
          <Text style={styles.successTitle}>Account Deleted</Text>
          <Text style={styles.successMessage}>
            Your account and associated data have been permanently deleted.
          </Text>
          <Text style={styles.successNote}>
            Redirecting to sign in...
          </Text>
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
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <View style={styles.warningIconRow}>
              <AlertTriangle size={24} color={colors.dark.error} />
              <Text style={styles.warningTitle}>Permanent Action</Text>
            </View>
            <Text style={styles.warningText}>
              Deleting your account is permanent and cannot be undone. You will lose access to your account and all associated data.
            </Text>
          </View>

          {/* Data that will be deleted */}
          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Data that will be permanently deleted:</Text>
            <View style={styles.dataList}>
              {[
                'Your user profile and login credentials',
                'All workout history and session records',
                'All athlete data and split times',
                'Saved preferences and settings',
                'Group assignments and configurations',
              ].map((item) => (
                <View key={item} style={styles.dataItem}>
                  <Trash2 size={14} color={colors.dark.error} />
                  <Text style={styles.dataItemText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Re-authentication */}
          <View style={styles.authSection}>
            <View style={styles.authHeaderRow}>
              <ShieldAlert size={18} color={colors.dark.warning} />
              <Text style={styles.authSectionTitle}>Verify Your Identity</Text>
            </View>
            <Text style={styles.authSubtitle}>
              Enter your password to confirm this action.
            </Text>

            {error !== '' && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
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
          </View>

          {/* Confirmation checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setConfirmed(!confirmed)}
            disabled={loading}
          >
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
              {confirmed && <CheckCircle size={16} color="#ffffff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              I understand this action is permanent and my data cannot be recovered.
            </Text>
          </TouchableOpacity>

          {/* Delete button */}
          <TouchableOpacity
            style={[styles.deleteButton, !canProceed && styles.deleteButtonDisabled]}
            onPress={handleDeleteRequest}
            disabled={!canProceed || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Trash2 size={18} color="#ffffff" />
                <Text style={styles.deleteButtonText}>Delete My Account</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Final Confirmation Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrapper}>
              <AlertTriangle size={32} color={colors.dark.error} />
            </View>
            <Text style={styles.modalTitle}>Final Confirmation</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to permanently delete your SOLO account and all associated data? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalCancelText}>Keep Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.modalDeleteText}>Delete Forever</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  warningBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  warningIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.error,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    lineHeight: 22,
  },
  dataSection: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  dataSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    marginBottom: spacing.md,
  },
  dataList: {
    gap: spacing.sm,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dataItemText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    flex: 1,
  },
  authSection: {
    marginBottom: spacing.lg,
  },
  authHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  authSectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  authSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginBottom: spacing.md,
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.dark.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.dark.error,
    borderColor: colors.dark.error,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: colors.dark.error,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
  },
  deleteButtonDisabled: {
    opacity: 0.4,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  cancelButton: {
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cancelButtonText: {
    color: colors.dark.textSecondary,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.dark.background,
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    alignItems: 'center',
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: spacing.sm,
  },
  modalMessage: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.dark.text,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
  },
  modalDeleteButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.dark.error,
    alignItems: 'center',
  },
  modalDeleteText: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
});
