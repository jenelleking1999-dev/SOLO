import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Mic, X, Check, AlertCircle } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface RecognizedAthlete {
  name: string;
  timestamp: number;
  splitTime: number;
}

interface VoiceAthleteCapturePanelProps {
  isListening: boolean;
  isProcessing: boolean;
  recognizedAthletes: RecognizedAthlete[];
  currentTranscript: string;
  error: string | null;
  onToggleListening: () => void;
  onRemoveAthlete: (name: string) => void;
  onClearAll: () => void;
  onConfirm: (athletes: RecognizedAthlete[]) => void;
  existingAthletes?: string[];
}

export function VoiceAthleteCapture({
  isListening,
  isProcessing,
  recognizedAthletes,
  currentTranscript,
  error,
  onToggleListening,
  onRemoveAthlete,
  onClearAll,
  onConfirm,
  existingAthletes = [],
}: VoiceAthleteCapturePanelProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
      pulseAnim.setValue(1);
    }
  }, [isListening, scaleAnim, pulseAnim]);

  const isNew = (athlete: RecognizedAthlete) => {
    return !existingAthletes.some((a) => a.toLowerCase() === athlete.name.toLowerCase());
  };

  return (
    <View style={styles.container}>
      {/* Listening Header */}
      <View style={[styles.header, isListening && styles.headerActive]}>
        <View style={styles.micContainer}>
          <Animated.View
            style={[
              styles.micPulse,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim,
              },
            ]}
          />
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={onToggleListening}
            disabled={isProcessing}
          >
            <Mic
              size={24}
              color={isListening ? colors.dark.error : colors.dark.primary}
              fill={isListening ? colors.dark.error : 'transparent'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.headerText}>
          <Text style={[styles.status, isListening && styles.statusActive]}>
            {isListening
              ? isProcessing
                ? 'Starting...'
                : 'Listening for athletes...'
              : 'Tap to start listening'}
          </Text>
          {currentTranscript && (
            <Text style={styles.transcript} numberOfLines={1}>
              "{currentTranscript}"
            </Text>
          )}
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={colors.dark.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Recognized Athletes */}
      {recognizedAthletes.length > 0 && (
        <View style={styles.athletesSection}>
          <Text style={styles.athletesLabel}>
            Recognized Athletes ({recognizedAthletes.length})
          </Text>

          <ScrollView
            style={styles.athletesList}
            showsVerticalScrollIndicator={false}
          >
            {recognizedAthletes.map((athlete, index) => (
              <View
                key={`${athlete.name}-${index}`}
                style={[
                  styles.athleteItem,
                  isNew(athlete) && styles.athleteItemNew,
                ]}
              >
                <View style={styles.athleteInfo}>
                  <Text style={styles.athleteName}>{athlete.name}</Text>
                  <View style={styles.athleteMeta}>
                    {isNew(athlete) && (
                      <Text style={styles.newBadge}>New</Text>
                    )}
                    <Text style={styles.splitTime}>
                      {formatTime(athlete.splitTime)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => onRemoveAthlete(athlete.name)}
                >
                  <X size={18} color={colors.dark.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => onConfirm(recognizedAthletes)}
            >
              <Check size={18} color="#ffffff" />
              <Text style={styles.confirmButtonText}>
                Record {recognizedAthletes.length} Athlete{recognizedAthletes.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={onClearAll}
            >
              <X size={18} color={colors.dark.error} />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Empty State */}
      {!recognizedAthletes.length && isListening && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Say athlete names as they finish...
          </Text>
        </View>
      )}
    </View>
  );
}

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 100).toString().padStart(1, '0')}`;
  }
  return `${remainingSeconds}.${Math.floor(milliseconds / 100).toString().padStart(1, '0')}s`;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  headerActive: {
    borderBottomColor: colors.dark.primary,
  },
  micContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.dark.error,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dark.cardGlass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  micButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: colors.dark.error,
  },
  headerText: {
    flex: 1,
  },
  status: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark.textSecondary,
    marginBottom: spacing.xs,
  },
  statusActive: {
    color: colors.dark.primary,
  },
  transcript: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    fontStyle: 'italic',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.dark.error,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  athletesSection: {
    marginTop: spacing.md,
  },
  athletesLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  athletesList: {
    maxHeight: 200,
    marginBottom: spacing.md,
  },
  athleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.dark.primary,
  },
  athleteItemNew: {
    borderLeftColor: colors.dark.secondary,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
    marginBottom: spacing.xs,
  },
  athleteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newBadge: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark.secondary,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  splitTime: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  removeButton: {
    padding: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  confirmButton: {
    backgroundColor: colors.dark.primary,
  },
  confirmButtonText: {
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    fontStyle: 'italic',
  },
});
