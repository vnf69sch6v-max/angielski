"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress } from "@/lib/types";
import DomainTag from "@/components/ui/DomainTag";

interface FlashCardProps {
  wordProgress: WordProgress;
  onAnswer: (rating: 1 | 2 | 3 | 4, responseTimeMs: number) => void;
}

export default function FlashCard({ wordProgress, onAnswer }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const startTime = useRef(Date.now());

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
        style={{ perspective: 1000, minHeight: 320 }}
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
            style={{ backfaceVisibility: "hidden", minHeight: 320 }}
          >
            <DomainTag domain={wordProgress.domain} size="md" className="mb-4" />
            <h2 className="text-4xl sm:text-5xl font-heading text-text-primary mb-3 text-center">
              {wordProgress.word}
            </h2>
            <p className="text-sm font-mono text-text-secondary mb-6">
              {wordProgress.partOfSpeech}
            </p>
            <p className="text-sm text-text-secondary/60 animate-pulse-soft">
              Dotknij aby odwrócić
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 w-full glass-card p-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              minHeight: 320,
            }}
          >
            <p className="text-sm font-body text-text-secondary mb-2">
              Tłumaczenie
            </p>
            <h3 className="text-3xl font-heading text-accent mb-4 text-center">
              {wordProgress.translation}
            </h3>
            {wordProgress.exampleSentences.length > 0 && (
              <div className="w-full mt-4 p-4 rounded-xl bg-bg/50 border border-border/50">
                <p className="text-sm text-text-secondary mb-1">Przykład:</p>
                <p className="text-base text-text-primary italic font-body">
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
            className="grid grid-cols-4 gap-2 mt-6"
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
