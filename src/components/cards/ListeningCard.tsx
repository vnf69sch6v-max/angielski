"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress } from "@/lib/types";
import { scoreListening } from "@/lib/algorithm/scoring";
import DomainTag from "@/components/ui/DomainTag";
import { useTTS } from "@/hooks/useTTS";

interface ListeningCardProps {
  wordProgress: WordProgress;
  onAnswer: (rating: 1 | 2 | 3 | 4, responseTimeMs: number) => void;
  onFallbackToQuiz?: () => void;
}

export default function ListeningCard({
  wordProgress,
  onAnswer,
  onFallbackToQuiz,
}: ListeningCardProps) {
  const [userInput, setUserInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<{
    rating: 1 | 2 | 3 | 4;
    distance: number;
  } | null>(null);
  const startTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak, isSpeaking, isAvailable } = useTTS();

  useEffect(() => {
    startTime.current = Date.now();
    setUserInput("");
    setSubmitted(false);
    setPlayCount(0);
    setShowHint(false);
    setResult(null);
  }, [wordProgress.wordId]);

  // Fallback to quiz if TTS unavailable
  useEffect(() => {
    if (!isAvailable && onFallbackToQuiz) {
      onFallbackToQuiz();
    }
  }, [isAvailable, onFallbackToQuiz]);

  const handlePlay = useCallback(() => {
    const newCount = playCount + 1;
    setPlayCount(newCount);

    // 3rd play → show first letter hint
    if (newCount >= 3) {
      setShowHint(true);
    }

    // Play at 0.9 rate for slightly slower speech
    speak(wordProgress.word, { rate: 0.9 });

    if (playCount === 0) {
      startTime.current = Date.now();
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  }, [playCount, speak, wordProgress.word]);

  // Auto-play on mount
  useEffect(() => {
    if (isAvailable) {
      const timer = setTimeout(() => handlePlay(), 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordProgress.wordId, isAvailable]);

  const handleSubmit = () => {
    if (!userInput.trim() || submitted) return;

    const responseTime = Date.now() - startTime.current;
    const scored = scoreListening(userInput, wordProgress.word);

    setResult(scored);
    setSubmitted(true);

    setTimeout(() => {
      onAnswer(scored.rating, responseTime);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (!isAvailable) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="glass-card p-8 text-center">
          <p className="text-4xl mb-4">🔇</p>
          <p className="text-text-secondary font-body">
            Synteza mowy niedostępna w tej przeglądarce.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 sm:p-8"
      >
        {/* Direction indicator */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-body text-text-secondary px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            🎧 Słuchanie
          </span>
          <DomainTag domain={wordProgress.domain} />
        </div>

        {/* Audio player area */}
        <div className="flex flex-col items-center mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePlay}
            disabled={isSpeaking || playCount >= 3}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 mb-4 ${
              isSpeaking
                ? "bg-accent/30 border-2 border-accent shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                : playCount >= 3
                ? "bg-bg-surface-hover border-2 border-border opacity-50"
                : "bg-accent/10 border-2 border-accent/30 hover:bg-accent/20 hover:border-accent/50"
            }`}
          >
            {isSpeaking ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <svg
                  className="w-10 h-10 text-accent"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              </motion.div>
            ) : (
              <svg
                className="w-10 h-10 text-accent"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            )}
          </motion.button>

          <div className="flex gap-1 mb-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i <= playCount ? "bg-accent" : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-text-secondary font-body">
            {playCount === 0
              ? "Kliknij aby odtworzyć"
              : playCount >= 3
              ? "Wykorzystano wszystkie odsłuchania"
              : `Odsłuchania: ${playCount}/3`}
          </p>

          {/* First letter hint */}
          {showHint && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-accent font-body mt-2"
            >
              💡 Podpowiedź: zaczyna się na &ldquo;
              {wordProgress.word.charAt(0).toUpperCase()}&rdquo;
            </motion.p>
          )}
        </div>

        {/* Input area */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary font-body block mb-2">
              Co usłyszałeś? Wpisz po angielsku:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitted}
              placeholder="Type what you heard..."
              autoComplete="off"
              autoCapitalize="off"
              className={`w-full px-4 py-3.5 rounded-xl font-body text-lg transition-all duration-300
                ${
                  submitted
                    ? result && result.rating >= 3
                      ? "bg-success/10 border-2 border-success text-success"
                      : "bg-error/10 border-2 border-error text-error"
                    : "bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                }
                placeholder:text-text-secondary/40`}
            />
          </div>

          {!submitted && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={!userInput.trim()}
              className="w-full py-3.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40
                text-white font-body font-medium transition-all"
            >
              Sprawdź
            </motion.button>
          )}

          {/* Result feedback */}
          <AnimatePresence>
            {submitted && result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    backgroundColor:
                      result.rating >= 3
                        ? "rgba(34,197,94,0.1)"
                        : "rgba(239,68,68,0.1)",
                    borderColor:
                      result.rating >= 3
                        ? "rgba(34,197,94,0.3)"
                        : "rgba(239,68,68,0.3)",
                  }}
                >
                  <p
                    className="text-sm font-body font-medium mb-1"
                    style={{
                      color: result.rating >= 3 ? "#22C55E" : "#EF4444",
                    }}
                  >
                    {result.rating === 4
                      ? "Doskonale!"
                      : result.rating === 3
                      ? "Prawie dobrze!"
                      : result.rating === 2
                      ? "Blisko"
                      : "Niestety źle"}
                  </p>
                  <p className="text-sm font-body text-text-secondary">
                    Poprawna odpowiedź:{" "}
                    <span className="text-text-primary font-medium">
                      {wordProgress.word}
                    </span>
                    {" — "}
                    <span className="text-text-secondary">
                      {wordProgress.translation}
                    </span>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
