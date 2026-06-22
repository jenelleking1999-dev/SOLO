import { useEffect, useState, useRef } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Continuous athlete-name capture via `expo-speech-recognition`. The native
 * module is absent in Expo Go, so everything is guarded behind `voiceAvailable`
 * and the module is lazily required only in dev/production builds.
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

export interface RecognizedAthlete {
  name: string;
  timestamp: number;
  splitTime: number;
}

export interface ContinuousVoiceState {
  isListening: boolean;
  isProcessing: boolean;
  recognizedAthletes: RecognizedAthlete[];
  currentTranscript: string;
  error: string | null;
  permissionDenied: boolean;
}

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const STOP_WORDS = ['the', 'and', 'or', 'is', 'a', 'for', 'to', 'of', 'go', 'next'];

function parseAthleteNames(transcript: string, existing: string[]): string[] {
  const lower = transcript.toLowerCase();
  const recognized: string[] = [];

  // First, match anyone already on the roster (case-insensitive).
  existing.forEach((athlete) => {
    const athleteLower = athlete.toLowerCase().trim();
    if (athleteLower && lower.includes(athleteLower)) {
      recognized.push(athlete);
    }
  });

  // If nobody on the roster matched, treat new words as first-time names.
  if (recognized.length === 0) {
    transcript
      .split(/[\s,\-—–]+/)
      .filter((w) => w.length > 2 && /^[a-zA-Z]+$/.test(w))
      .forEach((word) => {
        if (!STOP_WORDS.includes(word.toLowerCase())) {
          recognized.push(capitalize(word));
        }
      });
  }

  return recognized;
}

export function useContinuousVoiceAthletes(
  elapsedTime: number,
  existingAthletes: string[] = []
) {
  const [state, setState] = useState<ContinuousVoiceState>({
    isListening: false,
    isProcessing: false,
    recognizedAthletes: [],
    currentTranscript: '',
    error: null,
    permissionDenied: false,
  });

  const isMountedRef = useRef(true);
  // Keep the latest elapsed time / roster available inside event callbacks
  // without re-subscribing on every render.
  const elapsedRef = useRef(elapsedTime);
  const existingRef = useRef(existingAthletes);

  useEffect(() => {
    elapsedRef.current = elapsedTime;
  }, [elapsedTime]);

  useEffect(() => {
    existingRef.current = existingAthletes;
  }, [existingAthletes]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (voiceAvailable) {
        try {
          SpeechRecognition.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const addAthlete = (name: string, splitTime: number) => {
    setState((prev) => {
      const alreadyAdded = prev.recognizedAthletes.some(
        (a) => a.name.toLowerCase() === name.toLowerCase()
      );
      if (alreadyAdded) return prev;
      return {
        ...prev,
        recognizedAthletes: [
          ...prev.recognizedAthletes,
          { name: capitalize(name), timestamp: Date.now(), splitTime },
        ],
      };
    });
  };

  // Subscribe to native events once (only when voice is available).
  useEffect(() => {
    if (!voiceAvailable) return;

    const subs = [
      SpeechRecognition.addListener('start', () => {
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            isListening: true,
            isProcessing: false,
            error: null,
          }));
        }
      }),
      SpeechRecognition.addListener('end', () => {
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, isListening: false }));
        }
      }),
      SpeechRecognition.addListener('result', (event: any) => {
        if (!isMountedRef.current || !event?.results?.length) return;
        const transcript = event.results
          .map((r: any) => r.transcript)
          .join(' ')
          .trim();
        if (!transcript) return;

        setState((prev) => ({ ...prev, currentTranscript: transcript }));

        // Only act on finalized phrases to avoid duplicate partials.
        if (event.isFinal) {
          parseAthleteNames(transcript, existingRef.current).forEach((name) =>
            addAthlete(name, elapsedRef.current)
          );
        }
      }),
      SpeechRecognition.addListener('error', (event: any) => {
        if (!isMountedRef.current) return;
        const raw = String(event?.error ?? '').toLowerCase();
        const isPermissionError =
          raw.includes('permission') || raw.includes('not-allowed');
        setState((prev) => ({
          ...prev,
          error: `Voice error: ${event?.message || 'Please try again.'}`,
          permissionDenied: isPermissionError,
        }));
      }),
    ];

    return () => {
      subs.forEach((s) => s?.remove?.());
    };
  }, []);

  const startListening = async () => {
    if (!voiceAvailable) {
      setState((prev) => ({
        ...prev,
        error: 'Voice capture requires the installed app (not Expo Go).',
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isProcessing: true, error: null }));

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

      // `continuous: true` keeps the recognizer listening until we stop it,
      // so the coach can call out many names without restarting.
      SpeechRecognition.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      });
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error?.message || 'Failed to start listening',
        isProcessing: false,
      }));
    }
  };

  const stopListening = async () => {
    if (!voiceAvailable) return;
    try {
      SpeechRecognition.stop();
      setState((prev) => ({ ...prev, isListening: false, isProcessing: false }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error?.message || 'Failed to stop listening',
        isProcessing: false,
      }));
    }
  };

  const toggleListening = async () => {
    if (state.isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const clearRecognizedAthletes = () =>
    setState((prev) => ({ ...prev, recognizedAthletes: [] }));

  const clearError = () => setState((prev) => ({ ...prev, error: null }));

  const removeAthlete = (name: string) =>
    setState((prev) => ({
      ...prev,
      recognizedAthletes: prev.recognizedAthletes.filter(
        (a) => a.name.toLowerCase() !== name.toLowerCase()
      ),
    }));

  return {
    ...state,
    voiceAvailable,
    toggleListening,
    clearRecognizedAthletes,
    clearError,
    removeAthlete,
    startListening,
    stopListening,
  };
}
