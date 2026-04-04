"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress } from "@/lib/types";
import { scoreReverseTyping } from "@/lib/algorithm/scoring";
import DomainTag from "@/components/ui/DomainTag";

interface ReverseTypingCardProps {
  wordProgress: WordProgress;
  onAnswer: (rating: 1 | 2 | 3 | 4, responseTimeMs: number) => void;
}

export default function ReverseTypingCard({
  wordProgress,
  onAnswer,
}: ReverseTypingCardProps) {
  const [userInput, setUserInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    rating: 1 | 2 | 3 | 4;
    distance: number;
  } | null>(null);
  const startTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startTime.current = Date.now();
    setUserInput("");
    setSubmitted(false);
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [wordProgress.wordId]);

  const handleSubmit = () => {
    if (!userInput.trim() || submitted) return;

    const responseTime = Date.now() - startTime.current;
    const scored = scoreReverseTyping(userInput, wordProgress.word);

    setResult(scored);
    setSubmitted(true);

    // Small delay to show feedback before bubbling up
    setTimeout(() => {
      onAnswer(scored.rating, responseTime);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const getResultColor = () => {
    if (!result) return "";
    if (result.rating >= 3) return "#22C55E";
    if (result.rating === 2) return "#F59E0B";
    return "#EF4444";
  };

  const getResultLabel = () => {
    if (!result) return "";
    if (result.rating === 4) return "Doskonale!";
    if (result.rating === 3) return "Prawie dobrze!";
    if (result.rating === 2) return "Blisko, ale nie do końca";
    return "Niestety źle";
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 sm:p-8"
      >
        {/* Direction indicator */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-body text-text-secondary px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            PL → EN
          </span>
          <DomainTag domain={wordProgress.domain} />
        </div>

        {/* Polish word to translate */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-heading text-text-primary mb-2">
            {wordProgress.translation}
          </h2>
          <p className="text-sm font-mono text-text-secondary">
            {wordProgress.partOfSpeech}
          </p>
        </div>

        {/* Input area */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary font-body block mb-2">
              Wpisz po angielsku:
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={submitted}
                placeholder="Type the English word..."
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
              {submitted && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <span className="text-xl">
                    {result && result.rating >= 3 ? "✓" : "✗"}
                  </span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Submit button */}
          {!submitted && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={!userInput.trim()}
              className="w-full py-3.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent
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
                className="space-y-3"
              >
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    backgroundColor: `${getResultColor()}15`,
                    borderColor: `${getResultColor()}30`,
                  }}
                >
                  <p
                    className="text-sm font-body font-medium mb-1"
                    style={{ color: getResultColor() }}
                  >
                    {getResultLabel()}
                  </p>
                  <p className="text-sm font-body text-text-secondary">
                    Poprawna odpowiedź:{" "}
                    <span className="text-text-primary font-medium">
                      {wordProgress.word}
                    </span>
                  </p>
                  {result.distance > 0 && result.distance <= 4 && (
                    <p className="text-xs font-body text-text-secondary mt-1">
                      Odległość edycyjna: {result.distance}{" "}
                      {result.distance === 1
                        ? "litera"
                        : result.distance < 5
                        ? "litery"
                        : "liter"}
                    </p>
                  )}
                </div>

                {/* Mnemonic if available */}
                {wordProgress.mnemonic && (
                  <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                    <p className="text-xs text-accent/70 mb-1">
                      💡 Mnemotechnika:
                    </p>
                    <p className="text-sm text-accent font-body">
                      {wordProgress.mnemonic}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
