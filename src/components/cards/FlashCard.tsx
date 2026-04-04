"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress } from "@/lib/types";
import DomainTag from "@/components/ui/DomainTag";
import { useTTS } from "@/hooks/useTTS";

interface FlashCardProps {
  wordProgress: WordProgress;
  onAnswer: (rating: 1 | 2 | 3 | 4, responseTimeMs: number, reFlipUsed?: boolean) => void;
}

export default function FlashCard({ wordProgress, onAnswer }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReFlipped, setIsReFlipped] = useState(false);
  const [showReFlipAnswer, setShowReFlipAnswer] = useState(false);
  const startTime = useRef(Date.now());
  const { speak, isSpeaking } = useTTS();

  useEffect(() => {
    startTime.current = Date.now();
    setIsFlipped(false);
    setIsReFlipped(false);
    setShowReFlipAnswer(false);
  }, [wordProgress.wordId]);

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    const responseTime = Date.now() - startTime.current;
    // V3: Re-flip bonus — "Good" with re-flip becomes "Easy"
    let finalRating = rating;
    if (isReFlipped && showReFlipAnswer && rating === 3) {
      finalRating = 4; // production verified bonus
    }
    onAnswer(finalRating, responseTime, isReFlipped);
  };

  const handleReFlip = () => {
    setIsReFlipped(true);
  };

  const handleShowReFlipAnswer = () => {
    setShowReFlipAnswer(true);
  };

  const ratingButtons = [
    { rating: 1 as const, label: "Nie wiem", color: "#EF4444", bgColor: "rgba(239,68,68,0.15)" },
    { rating: 2 as const, label: "Trudne", color: "#F59E0B", bgColor: "rgba(245,158,11,0.15)" },
    { rating: 3 as const, label: "Dobrze", color: "#3B82F6", bgColor: "rgba(59,130,246,0.15)" },
    { rating: 4 as const, label: "Łatwo", color: "#22C55E", bgColor: "rgba(34,197,94,0.15)" },
  ];

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Card container with perspective */}
      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: 1000, minHeight: 280 }}
        onClick={() => !isFlipped && !isReFlipped && setIsFlipped(true)}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: isReFlipped ? 360 : isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
        >
          {/* Front — EN word */}
          <div
            className="absolute inset-0 w-full glass-card p-8 flex flex-col items-center justify-center"
            style={{ backfaceVisibility: "hidden", minHeight: 280 }}
          >
            <DomainTag domain={wordProgress.domain} size="md" className="mb-4" />
            <h2 className="text-4xl sm:text-5xl font-heading text-text-primary mb-3 text-center">
              {wordProgress.word}
            </h2>
            <p className="text-sm font-mono text-text-secondary mb-3">
              {wordProgress.partOfSpeech}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(wordProgress.word, { lang: "en-US" });
              }}
              className={`touch-target p-2 rounded-full transition-all duration-200 ${
                isSpeaking
                  ? "bg-accent/20 text-accent scale-110"
                  : "bg-bg-surface-hover text-text-secondary hover:text-accent hover:bg-accent/10"
              }`}
              title="Wymowa"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
            <p className="text-xs text-text-secondary/60 animate-pulse-soft mt-3">
              Dotknij aby odwrócić
            </p>
          </div>

          {/* Back — PL translation (or re-flip challenge) */}
          <div
            className="absolute inset-0 w-full glass-card p-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              minHeight: 280,
            }}
          >
            {!isReFlipped ? (
              <>
                {/* Normal back side */}
                <p className="text-sm font-body text-text-secondary mb-2">
                  Tłumaczenie
                </p>
                <h3 className="text-3xl font-heading text-accent mb-2 text-center">
                  {wordProgress.translation}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const textToSpeak = wordProgress.exampleSentences.length > 0
                      ? `${wordProgress.word}. ${wordProgress.exampleSentences[0]}`
                      : wordProgress.word;
                    speak(textToSpeak);
                  }}
                  className={`touch-target p-2 rounded-full transition-all duration-200 mb-2 ${
                    isSpeaking
                      ? "bg-accent/20 text-accent scale-110"
                      : "bg-bg-surface-hover text-text-secondary hover:text-accent hover:bg-accent/10"
                  }`}
                  title="Wymowa"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </button>
                {wordProgress.mnemonic && (
                  <div className="w-full mt-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
                    <p className="text-xs text-accent/70 mb-1">💡 Mnemotechnika:</p>
                    <p className="text-sm text-accent font-body">
                      {wordProgress.mnemonic}
                    </p>
                  </div>
                )}
                {wordProgress.exampleSentences.length > 0 && (
                  <div className="w-full mt-2 p-3 rounded-xl bg-bg/50 border border-border/50">
                    <p className="text-xs text-text-secondary mb-1">Przykład:</p>
                    <p className="text-sm text-text-primary italic font-body">
                      &ldquo;{wordProgress.exampleSentences[0]}&rdquo;
                    </p>
                  </div>
                )}

                {/* V3: Re-flip button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReFlip();
                  }}
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-bg-surface border border-border/50 text-text-secondary hover:text-accent hover:border-accent/30 transition-all"
                >
                  Sprawdź siebie ↩
                </button>
              </>
            ) : (
              <>
                {/* Re-flip challenge: PL visible, EN hidden */}
                <p className="text-sm font-body text-text-secondary mb-2">
                  Przypomnij sobie angielskie słowo:
                </p>
                <h3 className="text-2xl font-heading text-accent mb-4 text-center">
                  {wordProgress.translation}
                </h3>
                {!showReFlipAnswer ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowReFlipAnswer();
                    }}
                    className="px-6 py-3 rounded-xl bg-accent/20 border border-accent/30 text-accent font-body font-medium hover:bg-accent/30 transition-all"
                  >
                    Pokaż odpowiedź
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                  >
                    <h2 className="text-3xl font-heading text-text-primary mb-2">
                      {wordProgress.word}
                    </h2>
                    <p className="text-xs text-success/70 font-body">
                      ✨ Re-flip bonus aktywny (Dobrze → Łatwo)
                    </p>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Rating buttons — visible when flipped (normal or re-flip revealed) */}
      <AnimatePresence>
        {(isFlipped && !isReFlipped) || (isReFlipped && showReFlipAnswer) ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6"
          >
            {ratingButtons.map((btn) => (
              <motion.button
                key={btn.rating}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRate(btn.rating);
                }}
                className="touch-target flex flex-col items-center justify-center py-4 px-2 rounded-2xl font-body text-sm font-medium transition-all duration-300 border shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)] backdrop-blur-md"
                style={{
                  backgroundColor: btn.bgColor,
                  color: btn.color,
                  borderColor: `${btn.color}40`,
                }}
              >
                {btn.label}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
