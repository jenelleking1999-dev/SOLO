import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { AlertCircle, Check, Volume2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface VoiceFeedbackProps {
  transcript: string;
  error: string | null;
  isRecording: boolean;
  onTranscriptAccept: (transcript: string) => void;
  onTranscriptClear: () => void;
}

export function VoiceFeedback({
  transcript,
  error,
  isRecording,
  onTranscriptAccept,
  onTranscriptClear,
}: VoiceFeedbackProps) {
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    if (transcript || error) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [transcript, error, slideAnim]);

  if (!transcript && !error) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {error ? (
        <View style={[styles.content, styles.errorContent]}>
          <AlertCircle size={20} color={colors.dark.error} />
          <View style={styles.textContent}>
            <Text style={styles.errorTitle}>Recognition Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.content, styles.successContent]}>
            <Volume2 size={20} color={colors.dark.primary} />
            <View style={styles.textContent}>
              <Text style={styles.label}>Transcribed Workout</Text>
              <Text style={styles.transcript} numberOfLines={3}>
                {transcript}
              </Text>
              {isRecording && <Text style={styles.recordingLabel}>Recording...</Text>}
            </View>
          </View>
          {!isRecording && transcript && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => onTranscriptAccept(transcript)}
              >
                <Check size={18} color="#ffffff" />
                <Text style={styles.acceptButtonText}>Use This</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton]}
                onPress={() => {
                  Alert.alert('Clear Transcription', 'Discard this recording?', [
                    { text: 'Cancel', onPress: () => {} },
                    {
                      text: 'Clear',
                      onPress: onTranscriptClear,
                      style: 'destructive',
                    },
                  ]);
                }}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorContent: {
    borderColor: colors.dark.error,
    borderLeftWidth: 3,
  },
  successContent: {
    borderColor: colors.dark.primary,
    borderLeftWidth: 3,
  },
  textContent: {
    flex: 1,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark.textSecondary,
    marginBottom: spacing.xs,
  },
  transcript: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.error,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    lineHeight: 18,
  },
  recordingLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.primary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: colors.dark.primary,
  },
  acceptButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#ffffff',
  },
  clearButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.dark.error,
  },
  clearButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.error,
  },
});
