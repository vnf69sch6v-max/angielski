"use client";

import { useCallback, useRef, useState } from "react";

interface TTSOptions {
  rate?: number;
  lang?: string;
}

/**
 * Text-to-Speech hook using Web Speech API
 * Speaks English words/sentences with native browser TTS.
 */
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isAvailable =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = useCallback(
    (text: string, options?: TTSOptions) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;

      const lang = options?.lang || "en-US";
      const rate = options?.rate || 0.85;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Try to find a good English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find(
          (v) => v.lang.startsWith("en") && v.name.includes("Google")
        ) ||
        voices.find(
          (v) => v.lang.startsWith("en") && v.name.includes("Samantha")
        ) ||
        voices.find((v) => v.lang.startsWith("en"));

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isAvailable, isSupported: isAvailable };
}
