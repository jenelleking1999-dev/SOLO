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
  // Accumulates every finalized phrase so continuous dictation builds up the
  // full transcript instead of each new phrase overwriting the last one.
  const finalTranscriptRef = useRef('');
  // True between a user-initiated start and a user-initiated stop. Lets us
  // auto-restart the recognizer if the OS ends it on silence, so recording
  // truly continues until the user taps the mic again.
  const wantListeningRef = useRef(false);

  const beginRecognition = () => {
    SpeechRecognition.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Stop any in-progress recording if the screen unmounts mid-session.
      wantListeningRef.current = false;
      if (voiceAvailable) {
        try {
          SpeechRecognition.stop();
        } catch {
          // ignore
        }
      }
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
        if (!isMountedRef.current) return;
        // The OS ended the session (e.g. silence timeout) but the user hasn't
        // tapped stop — restart so recording stays continuous.
        if (wantListeningRef.current && voiceAvailable) {
          try {
            beginRecognition();
            return;
          } catch {
            // fall through and mark as stopped
          }
        }
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
        }));
      }),
      SpeechRecognition.addListener('result', (event: any) => {
        if (!isMountedRef.current || !event?.results?.length) return;

        const phrase = event.results
          .map((r: any) => r.transcript)
          .join(' ')
          .trim();
        if (!phrase) return;

        if (event.isFinal) {
          // Lock in this finalized phrase and append it to the running text.
          finalTranscriptRef.current =
            `${finalTranscriptRef.current} ${phrase}`.trim();
          setState((prev) => ({ ...prev, transcript: finalTranscriptRef.current }));
        } else {
          // Show finalized text so far plus the in-progress (interim) phrase.
          const live = `${finalTranscriptRef.current} ${phrase}`.trim();
          setState((prev) => ({ ...prev, transcript: live }));
        }
      }),
      SpeechRecognition.addListener('error', (event: any) => {
        if (!isMountedRef.current) return;
        const raw = String(event?.error ?? '').toLowerCase();
        const isPermissionError =
          raw.includes('permission') || raw.includes('not-allowed');
        // "no-speech" / "speech-timeout" are transient — let the end handler
        // auto-restart. Permission/abort/audio errors are fatal: stop the loop.
        const isFatal =
          isPermissionError ||
          raw.includes('aborted') ||
          raw.includes('audio') ||
          raw.includes('service-not-allowed');

        if (isFatal) {
          wantListeningRef.current = false;
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
      // Reset the running transcript for a fresh dictation session.
      finalTranscriptRef.current = '';
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

      // `continuous: true` keeps recording across pauses until the user taps
      // the mic again (which calls stop() and finalizes the transcript).
      wantListeningRef.current = true;
      beginRecognition();
    } catch (error: any) {
      wantListeningRef.current = false;
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
      // Clear intent first so the resulting `end` event does not auto-restart.
      wantListeningRef.current = false;
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
