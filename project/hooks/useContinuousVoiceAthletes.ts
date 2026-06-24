import { useEffect, useState, useRef } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Continuous athlete-name capture via `expo-speech-recognition`. The native
 * module is absent in Expo Go, so everything is guarded behind `voiceAvailable`
 * and the module is lazily required only in dev/production builds.
 *
 * This hook does NOT track split times. The workout screen captures the precise
 * split time on tap; this hook simply listens continuously and calls
 * `onNameRecognized` whenever the coach calls out an athlete's name, so the
 * screen can pair that name with the tapped split.
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

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const STOP_WORDS = [
  'the', 'and', 'or', 'is', 'a', 'for', 'to', 'of', 'go', 'next',
  'okay', 'ok', 'yeah', 'now', 'got', 'it', 'that', 'good', 'nice',
];

/**
 * Pull a single best athlete name out of a spoken phrase. Each tap corresponds
 * to one athlete, so we return at most one name.
 */
function pickName(transcript: string, roster: string[]): string | null {
  const lower = transcript.toLowerCase();

  // Prefer a name already on the roster (use its canonical spelling).
  for (const athlete of roster) {
    const a = athlete.toLowerCase().trim();
    if (a && lower.includes(a)) return athlete;
  }

  // Otherwise take the last meaningful word as the name (people often lead with
  // filler, e.g. "okay, Sarah").
  const words = transcript
    .split(/[\s,\-—–]+/)
    .filter(
      (w) => /^[a-zA-Z]+$/.test(w) && w.length > 2 && !STOP_WORDS.includes(w.toLowerCase())
    );
  if (words.length === 0) return null;
  return capitalize(words[words.length - 1]);
}

export interface UseVoiceAthleteNamesOptions {
  existingAthletes: string[];
  onNameRecognized: (name: string) => void;
}

export function useContinuousVoiceAthletes({
  existingAthletes,
  onNameRecognized,
}: UseVoiceAthleteNamesOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isMountedRef = useRef(true);
  // True between a user-initiated start and stop; lets us auto-restart if the
  // OS ends recognition on a silence timeout so listening stays continuous.
  const wantListeningRef = useRef(false);
  // Keep latest roster / callback available inside listeners without
  // re-subscribing on every render.
  const rosterRef = useRef(existingAthletes);
  const onNameRef = useRef(onNameRecognized);

  useEffect(() => {
    rosterRef.current = existingAthletes;
  }, [existingAthletes]);

  useEffect(() => {
    onNameRef.current = onNameRecognized;
  }, [onNameRecognized]);

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

  useEffect(() => {
    if (!voiceAvailable) return;

    const subs = [
      SpeechRecognition.addListener('start', () => {
        if (isMountedRef.current) {
          setIsListening(true);
          setIsProcessing(false);
          setError(null);
        }
      }),
      SpeechRecognition.addListener('end', () => {
        if (!isMountedRef.current) return;
        if (wantListeningRef.current && voiceAvailable) {
          try {
            beginRecognition();
            return;
          } catch {
            // fall through and mark as stopped
          }
        }
        setIsListening(false);
      }),
      SpeechRecognition.addListener('result', (event: any) => {
        if (!isMountedRef.current || !event?.results?.length) return;
        const phrase = event.results
          .map((r: any) => r.transcript)
          .join(' ')
          .trim();
        if (!phrase) return;

        setCurrentTranscript(phrase);

        // Only act on finalized phrases so we don't fire on every interim word.
        if (event.isFinal) {
          const name = pickName(phrase, rosterRef.current);
          if (name) onNameRef.current(name);
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
          setError(`Voice error: ${event?.message || 'Please try again.'}`);
          setPermissionDenied(isPermissionError);
          setIsListening(false);
          setIsProcessing(false);
        }
      }),
    ];

    return () => {
      subs.forEach((s) => s?.remove?.());
    };
  }, []);

  const startListening = async () => {
    if (!voiceAvailable) {
      setError('Voice capture requires the installed app (not Expo Go).');
      return;
    }
    try {
      setIsProcessing(true);
      setError(null);
      const perm = await SpeechRecognition.requestPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied(true);
        setIsProcessing(false);
        setError('Microphone permission denied');
        return;
      }
      wantListeningRef.current = true;
      beginRecognition();
    } catch (e: any) {
      wantListeningRef.current = false;
      setError(e?.message || 'Failed to start listening');
      setIsProcessing(false);
    }
  };

  const stopListening = async () => {
    if (!voiceAvailable) return;
    try {
      wantListeningRef.current = false;
      SpeechRecognition.stop();
      setIsListening(false);
      setIsProcessing(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to stop listening');
      setIsProcessing(false);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const clearError = () => setError(null);

  return {
    voiceAvailable,
    isListening,
    isProcessing,
    currentTranscript,
    error,
    permissionDenied,
    toggleListening,
    startListening,
    stopListening,
    clearError,
  };
}
