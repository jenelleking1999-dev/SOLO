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
  // How many words of the current utterance have already been turned into a
  // name. In continuous mode the recognizer returns a growing transcript, so we
  // only act on the words added since last time.
  const processedWordsRef = useRef(0);
  // Interim results get revised as the recognizer refines a word ("Sha" ->
  // "Sarah"), so we wait for it to settle before acting on new words.
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SETTLE_MS = 800;
  // The native module is a singleton and broadcasts events to every subscribed
  // listener, including the Home screen's dictation hook (whose tab stays
  // mounted during a workout). Only handle events from a session we started.
  const isOwnerRef = useRef(false);

  // Keep latest roster / callback available inside listeners without
  // re-subscribing on every render.
  const rosterRef = useRef(existingAthletes);
  const onNameRef = useRef(onNameRecognized);

  /** Turn only the words added since last time into an athlete name. */
  const consumeNewWords = (phrase: string) => {
    if (!isMountedRef.current) return;
    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length <= processedWordsRef.current) return; // nothing new said
    const fresh = words.slice(processedWordsRef.current);
    processedWordsRef.current = words.length;
    const name = pickName(fresh.join(' '), rosterRef.current);
    if (name) onNameRef.current(name);
  };

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
      // Default is 5. Extra alternatives are competing transcriptions of the
      // same utterance, and concatenating them corrupts the name matching.
      maxAlternatives: 1,
      // Bias the recognizer toward the names it should expect to hear.
      contextualStrings: rosterRef.current.slice(0, 100),
    });
  };

  /**
   * `results` holds ALTERNATIVE transcriptions of the same utterance, ordered
   * best-first — not consecutive segments. Only the first is the best guess.
   */
  const bestTranscript = (event: any): string =>
    (event?.results?.[0]?.transcript ?? '').trim();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      wantListeningRef.current = false;
      isOwnerRef.current = false;
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
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
        if (isMountedRef.current && isOwnerRef.current) {
          // A new session starts with an empty transcript.
          processedWordsRef.current = 0;
          setIsListening(true);
          setIsProcessing(false);
          setError(null);
        }
      }),
      SpeechRecognition.addListener('end', () => {
        if (!isMountedRef.current || !isOwnerRef.current) return;
        if (wantListeningRef.current && voiceAvailable) {
          try {
            beginRecognition();
            return;
          } catch {
            // fall through and mark as stopped
          }
        }
        isOwnerRef.current = false;
        setIsListening(false);
      }),
      SpeechRecognition.addListener('result', (event: any) => {
        if (!isMountedRef.current || !isOwnerRef.current) return;
        const phrase = bestTranscript(event);
        if (!phrase) return;

        setCurrentTranscript(phrase);

        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

        if (event.isFinal) {
          // Utterance closed: consume it now and start a fresh transcript window.
          consumeNewWords(phrase);
          processedWordsRef.current = 0;
        } else {
          // In continuous mode `isFinal` often never fires, so act on interim
          // results once the recognizer has settled on the word.
          settleTimerRef.current = setTimeout(
            () => consumeNewWords(phrase),
            SETTLE_MS
          );
        }
      }),
      SpeechRecognition.addListener('error', (event: any) => {
        if (!isMountedRef.current || !isOwnerRef.current) return;
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
          isOwnerRef.current = false;
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
      isOwnerRef.current = true;
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
