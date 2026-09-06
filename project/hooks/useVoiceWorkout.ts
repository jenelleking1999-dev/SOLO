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
  // The recognizer returns a CUMULATIVE transcript for the current session, so
  // this holds that latest phrase and is replaced (never appended) while the
  // session runs. It is folded into finalTranscriptRef only when the utterance
  // or session ends, which is what keeps text from being duplicated.
  const sessionPhraseRef = useRef('');
  // True between a user-initiated start and a user-initiated stop. Lets us
  // auto-restart the recognizer if the OS ends it on silence, so recording
  // truly continues until the user taps the mic again.
  const wantListeningRef = useRef(false);
  // The native module is a singleton and its events are broadcast to EVERY
  // subscribed listener. The Home tab stays mounted during a workout, so
  // without this flag the athlete names called out on the session screen would
  // stream into the workout builder's transcript. Only handle events belonging
  // to a recognition session this hook actually started.
  const isOwnerRef = useRef(false);

  const beginRecognition = () => {
    SpeechRecognition.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      // Default is 5. Anything above 1 returns competing transcriptions of the
      // same utterance, which we would otherwise concatenate into duplicated text.
      maxAlternatives: 1,
    });
  };

  /**
   * `results` holds ALTERNATIVE transcriptions of the same utterance, ordered
   * best-first — not consecutive segments. Only the first is the recognizer's
   * best guess; joining them duplicates and garbles the phrase.
   */
  const bestTranscript = (event: any): string =>
    (event?.results?.[0]?.transcript ?? '').trim();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Stop any in-progress recording if the screen unmounts mid-session.
      wantListeningRef.current = false;
      isOwnerRef.current = false;
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
        if (isMountedRef.current && isOwnerRef.current) {
          // Clear isProcessing here so the mic button becomes tappable again
          // (it is disabled while processing) — otherwise the user can't stop.
          sessionPhraseRef.current = '';
          setState((prev) => ({
            ...prev,
            isRecording: true,
            isProcessing: false,
            error: null,
          }));
        }
      }),
      SpeechRecognition.addListener('end', () => {
        if (!isMountedRef.current || !isOwnerRef.current) return;
        // The OS ended the session (e.g. silence timeout) but the user hasn't
        // tapped stop — restart so recording stays continuous.
        if (wantListeningRef.current && voiceAvailable) {
          try {
            // The ending session's transcript is lost on restart, so commit any
            // interim text first or the user's words would disappear.
            if (sessionPhraseRef.current) {
              finalTranscriptRef.current =
                `${finalTranscriptRef.current} ${sessionPhraseRef.current}`.trim();
              sessionPhraseRef.current = '';
            }
            beginRecognition();
            return;
          } catch {
            // fall through and mark as stopped
          }
        }
        // This hook no longer owns the recognizer, so later events (e.g. from
        // the workout screen's athlete capture) must not reach the transcript.
        isOwnerRef.current = false;
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
        }));
      }),
      SpeechRecognition.addListener('result', (event: any) => {
        if (!isMountedRef.current || !isOwnerRef.current) return;

        const phrase = bestTranscript(event);
        if (!phrase) return;

        if (event.isFinal) {
          // Utterance closed: fold it into the committed text and start fresh.
          finalTranscriptRef.current =
            `${finalTranscriptRef.current} ${phrase}`.trim();
          sessionPhraseRef.current = '';
          setState((prev) => ({ ...prev, transcript: finalTranscriptRef.current }));
        } else {
          // Interim results are cumulative for this session, so REPLACE the
          // session phrase rather than appending it.
          sessionPhraseRef.current = phrase;
          const live = `${finalTranscriptRef.current} ${phrase}`.trim();
          setState((prev) => ({ ...prev, transcript: live }));
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
      sessionPhraseRef.current = '';
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
      isOwnerRef.current = true;
      beginRecognition();
      // Optimistically mark as recording and clear processing so the mic
      // button is immediately tappable to stop, even if the native `start`
      // event is delayed or doesn't fire (e.g. on web).
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, isRecording: true, isProcessing: false }));
      }
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
