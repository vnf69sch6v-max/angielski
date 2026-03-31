"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress } from "@/lib/types";
import DomainTag from "@/components/ui/DomainTag";
import { useTTS } from "@/hooks/useTTS";

interface FlashCardProps {
  wordProgress: WordProgress;
  onAnswer: (rating: 1 | 2 | 3 | 4, responseTimeMs: number) => void;
}

export default function FlashCard({ wordProgress, onAnswer }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const startTime = useRef(Date.now());
  const { speak, isSpeaking } = useTTS();

  useEffect(() => {
    startTime.current = Date.now();
    setIsFlipped(false);
  }, [wordProgress.wordId]);

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    const responseTime = Date.now() - startTime.current;
    onAnswer(rating, responseTime);
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
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
        >
          {/* Front */}
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
                speak(wordProgress.word);
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

          {/* Back */}
          <div
            className="absolute inset-0 w-full glass-card p-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              minHeight: 280,
            }}
          >
            <p className="text-sm font-body text-text-secondary mb-2">
              Tłumaczenie
            </p>
            <h3 className="text-3xl font-heading text-accent mb-2 text-center">
              {wordProgress.translation}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const text = wordProgress.exampleSentences.length > 0
                  ? `${wordProgress.word}. ${wordProgress.exampleSentences[0]}`
                  : wordProgress.word;
                speak(text);
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
          </div>
        </motion.div>
      </div>

      {/* Rating buttons (only visible when flipped) */}
      <AnimatePresence>
        {isFlipped && (
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
        )}
      </AnimatePresence>
    </div>
  );
}
