import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Mic } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';

interface VoiceInputButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  onPress: () => void;
}

export function VoiceInputButton({
  isRecording,
  isProcessing,
  onPress,
}: VoiceInputButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    }
  }, [isRecording, scaleAnim, opacityAnim]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isProcessing}
      style={[
        styles.button,
        isRecording && styles.buttonRecording,
        isProcessing && styles.buttonProcessing,
      ]}
    >
      {isRecording && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}
      <Mic
        size={20}
        color={isRecording ? colors.dark.error : colors.dark.primary}
        fill={isRecording ? colors.dark.error : 'transparent'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.dark.error,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark.cardGlass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonRecording: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: colors.dark.error,
  },
  buttonProcessing: {
    opacity: 0.5,
  },
});
