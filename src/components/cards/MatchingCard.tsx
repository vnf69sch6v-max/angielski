"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";


interface MatchingPair {
  wordId: string;
  word: string;
  translation: string;
}

interface MatchingCardProps {
  pairs: MatchingPair[];
  onAnswer: (correctCount: number, responseTimeMs: number) => void;
}

export default function MatchingCard({ pairs, onAnswer }: MatchingCardProps) {
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);
  const [shuffledRight, setShuffledRight] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const startTime = useRef(Date.now());

  const pairsStr = JSON.stringify(pairs);

  useEffect(() => {
    startTime.current = Date.now();
    setMatched(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPair(null);
    setIsComplete(false);
    setCorrectCount(0);

    // Shuffle right column indices
    const indices = pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledRight(indices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsStr]);

  const tryMatch = useCallback(
    (leftIdx: number, rightIdx: number) => {
      const realRightIdx = shuffledRight[rightIdx];

      // FIX 1 (V3): Compare by wordId, not positional index
      if (pairs[leftIdx].wordId === pairs[realRightIdx].wordId) {
        // Correct match
        setMatched((prev) => new Set([...Array.from(prev), leftIdx]));
        setCorrectCount((prev) => prev + 1);
        setSelectedLeft(null);
        setSelectedRight(null);

        if (matched.size + 1 === pairs.length) {
          setIsComplete(true);
          const responseTime = Date.now() - startTime.current;
          setTimeout(() => {
            onAnswer(correctCount + 1, responseTime);
          }, 1000);
        }
      } else {
        // Wrong match
        setWrongPair({ left: leftIdx, right: rightIdx });
        setTimeout(() => {
          setWrongPair(null);
          setSelectedLeft(null);
          setSelectedRight(null);
        }, 800);
      }
    },
    [shuffledRight, matched, pairs, correctCount, onAnswer]
  );

  const handleLeftClick = (index: number) => {
    if (matched.has(index) || isComplete) return;
    setSelectedLeft(index);
    if (selectedRight !== null) {
      tryMatch(index, selectedRight);
    }
  };

  const handleRightClick = (index: number) => {
    const realIdx = shuffledRight[index];
    if (matched.has(realIdx) || isComplete) return;
    setSelectedRight(index);
    if (selectedLeft !== null) {
      tryMatch(selectedLeft, index);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-heading text-text-primary">
            Dopasuj pary
          </h3>
          <span className="text-sm font-body text-text-secondary">
            {matched.size}/{pairs.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Left column — English words */}
          <div className="space-y-2">
            {pairs.map((pair, index) => {
              const isMatched = matched.has(index);
              const isSelected = selectedLeft === index;
              const isWrong = wrongPair?.left === index;

              return (
                <motion.button
                  key={`left-${index}`}
                  whileTap={!isMatched ? { scale: 0.95 } : {}}
                  animate={
                    isWrong
                      ? { x: [0, -5, 5, -5, 5, 0] }
                      : isMatched
                      ? { scale: [1, 1.05, 1], opacity: 0.5 }
                      : {}
                  }
                  transition={{ duration: 0.3 }}
                  onClick={() => handleLeftClick(index)}
                  disabled={isMatched}
                  className={`
                    touch-target w-full p-3 rounded-xl border text-left font-body text-sm
                    transition-all duration-200
                    ${isMatched ? "opacity-50 cursor-default" : "cursor-pointer"}
                    ${
                      isSelected
                        ? "border-accent bg-accent-muted text-accent"
                        : isWrong
                        ? "border-error bg-error-muted text-error"
                        : "border-border bg-bg-surface hover:bg-bg-surface-hover text-text-primary"
                    }
                  `}
                >
                  {pair.word}
                </motion.button>
              );
            })}
          </div>

          {/* Right column — Polish translations (shuffled) */}
          <div className="space-y-2">
            {shuffledRight.map((realIndex, displayIndex) => {
              const isMatched = matched.has(realIndex);
              const isSelected = selectedRight === displayIndex;
              const isWrong = wrongPair?.right === displayIndex;

              return (
                <motion.button
                  key={`right-${displayIndex}`}
                  whileTap={!isMatched ? { scale: 0.95 } : {}}
                  animate={
                    isWrong
                      ? { x: [0, -5, 5, -5, 5, 0] }
                      : isMatched
                      ? { scale: [1, 1.05, 1], opacity: 0.5 }
                      : {}
                  }
                  transition={{ duration: 0.3 }}
                  onClick={() => handleRightClick(displayIndex)}
                  disabled={isMatched}
                  className={`
                    touch-target w-full p-3 rounded-xl border text-left font-body text-sm
                    transition-all duration-200
                    ${isMatched ? "opacity-50 cursor-default" : "cursor-pointer"}
                    ${
                      isSelected
                        ? "border-accent bg-accent-muted text-accent"
                        : isWrong
                        ? "border-error bg-error-muted text-error"
                        : "border-border bg-bg-surface hover:bg-bg-surface-hover text-text-primary"
                    }
                  `}
                >
                  {pairs[realIndex].translation}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Completion message */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-xl bg-success-muted border border-success/30 text-center"
            >
              <p className="text-success font-body font-medium">
                🎉 Wszystkie pary dopasowane! ({correctCount}/{pairs.length})
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
