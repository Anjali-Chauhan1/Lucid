"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input for explaining out loud.
 *
 * Uses the browser-native Web Speech API rather than a hosted transcription
 * service: it is free, needs no extra API key, and streams interim results so
 * the student sees words appear while still talking. Teaching is a spoken act —
 * typing an explanation is a worse proxy for it.
 *
 * Degrades to typing wherever the API is unavailable (notably Firefox), so
 * voice is strictly additive.
 */

// The Web Speech API is not in TypeScript's DOM lib, so declare what we use.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechInput {
  supported: boolean;
  listening: boolean;
  /** words recognized but not yet finalized — render these greyed out */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * @param onFinalText called with each finalized chunk, to append to the draft
 */
export function useSpeechInput(onFinalText: (chunk: string) => void): SpeechInput {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callback without re-creating the recognizer on every render.
  // Synced in an effect, not during render — a render-phase ref write is unsafe
  // under concurrent rendering.
  const onFinalRef = useRef(onFinalText);
  useEffect(() => {
    onFinalRef.current = onFinalText;
  }, [onFinalText]);
  // Distinguishes a deliberate stop() from the browser's idle auto-stop.
  const wantListeningRef = useRef(false);

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- the Web Speech
       API only exists on `window`, so support can only be detected after mount;
       detecting it during render would break SSR. */
    setSupported(true);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalChunk = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += text;
        else pending += text;
      }
      setInterim(pending);
      if (finalChunk.trim()) onFinalRef.current(finalChunk.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied — you can still type."
          : `Voice input error: ${event.error}`,
      );
      wantListeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      // Chrome stops after a pause; restart if the user hasn't pressed stop.
      if (wantListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* fall through to stopping */
        }
      }
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    return () => {
      wantListeningRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || wantListeningRef.current) return;
    setError(null);
    wantListeningRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      wantListeningRef.current = false;
      setError("Could not start the microphone.");
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    wantListeningRef.current = false;
    setInterim("");
    if (recognition) recognition.stop();
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop };
}
