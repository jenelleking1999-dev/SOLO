import { useEffect, useState, useRef } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Voice / speech recognition relies on the `expo-speech-recognition` native
 * module. That module is NOT bundled inside the Expo Go app, so we must never
 * touch it while running in Expo Go (doing so crashes the JS bundle on launch).
 *
 * `voiceAvailable` is true only in a development build or a production build,
 * where the native module is compiled in. We lazily `require` the module behind
 * this guard so Metro never evaluates its native bindings inside Expo Go.
 */
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let SpeechRecognition: any = null;
export let voiceAvailable = false;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-speech-recognition');
    SpeechRecognition = mod.ExpoSpeechRecognitionModule;
    voiceAvailable = !!SpeechRecognition;
  } catch {
    voiceAvailable = false;
  }
}

export interface VoiceWorkoutState {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
  permissionDenied: boolean;
}

export function useVoiceWorkout() {
  const [state, setState] = useState<VoiceWorkoutState>({
    isRecording: false,
    isProcessing: false,
    transcript: '',
    error: null,
    permissionDenied: false,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Subscribe to native speech-recognition events (only when available).
  useEffect(() => {
    if (!voiceAvailable) return;

    const subs = [
      SpeechRecognition.addListener('start', () => {
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, isRecording: true, error: null }));
        }
      }),
      SpeechRecognition.addListener('end', () => {
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            isRecording: false,
            isProcessing: false,
          }));
        }
      }),
      SpeechRecognition.addListener('result', (event: any) => {
        if (isMountedRef.current && event?.results?.length) {
          const transcript = event.results
            .map((r: any) => r.transcript)
            .join(' ')
            .trim();
          setState((prev) => ({ ...prev, transcript }));
        }
      }),
      SpeechRecognition.addListener('error', (event: any) => {
        if (isMountedRef.current) {
          const raw = String(event?.error ?? '').toLowerCase();
          const isPermissionError =
            raw.includes('permission') || raw.includes('not-allowed');
          setState((prev) => ({
            ...prev,
            error: `Could not recognize speech. ${event?.message || 'Please try again.'}`,
            isRecording: false,
            isProcessing: false,
            permissionDenied: isPermissionError,
          }));
        }
      }),
    ];

    return () => {
      subs.forEach((s) => s?.remove?.());
    };
  }, []);

  const startRecording = async () => {
    if (!voiceAvailable) {
      setState((prev) => ({
        ...prev,
        error: 'Voice input requires the installed app (not Expo Go).',
      }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isProcessing: true,
        error: null,
        transcript: '',
      }));

      const perm = await SpeechRecognition.requestPermissionsAsync();
      if (!perm.granted) {
        setState((prev) => ({
          ...prev,
          permissionDenied: true,
          isProcessing: false,
          error: 'Microphone permission denied',
        }));
        return;
      }

      SpeechRecognition.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error?.message || 'Failed to start recording',
        isProcessing: false,
      }));
    }
  };

  const stopRecording = async () => {
    if (!voiceAvailable) return;
    try {
      SpeechRecognition.stop();
      setState((prev) => ({ ...prev, isRecording: false }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error?.message || 'Failed to stop recording',
        isProcessing: false,
      }));
    }
  };

  const toggleRecording = async () => {
    if (state.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const clearError = () => setState((prev) => ({ ...prev, error: null }));
  const resetTranscript = () =>
    setState((prev) => ({ ...prev, transcript: '' }));

  return {
    ...state,
    voiceAvailable,
    toggleRecording,
    clearError,
    resetTranscript,
    startRecording,
    stopRecording,
  };
}
