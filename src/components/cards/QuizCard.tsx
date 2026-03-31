"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress, QuizData } from "@/lib/types";
import DomainTag from "@/components/ui/DomainTag";
import { useTTS } from "@/hooks/useTTS";

interface QuizCardProps {
  wordProgress: WordProgress;
  quizData: QuizData;
  onAnswer: (wasCorrect: boolean, responseTimeMs: number) => void;
}

export default function QuizCard({
  wordProgress,
  quizData,
  onAnswer,
}: QuizCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const startTime = useRef(Date.now());
  const { speak, isSpeaking } = useTTS();

  useEffect(() => {
    startTime.current = Date.now();
    setSelectedIndex(null);
    setShowResult(false);
  }, [wordProgress.wordId]);

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedIndex(index);
    setShowResult(true);

    const responseTime = Date.now() - startTime.current;
    const wasCorrect = index === quizData.correctIndex;

    // Delay callback to let user see feedback
    setTimeout(() => {
      onAnswer(wasCorrect, responseTime);
    }, 2000);
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="glass-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <DomainTag domain={wordProgress.domain} />
          <span className="text-xs font-body text-text-secondary flex-1">
            Uzupełnij zdanie
          </span>
          <button
            onClick={() => speak(quizData.sentence.replace("___", wordProgress.word))}
            className={`touch-target p-2 rounded-full transition-all duration-200 ${
              isSpeaking
                ? "bg-accent/20 text-accent"
                : "text-text-secondary hover:text-accent hover:bg-accent/10"
            }`}
            title="Wymowa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
        </div>

        {/* Sentence with blank */}
        <p className="text-xl sm:text-2xl font-body text-text-primary leading-relaxed mb-8">
          {quizData.sentence.split("___").map((part, i, arr) => (
            <React.Fragment key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className="inline-block min-w-[80px] border-b-2 border-accent mx-1">
                  {showResult && selectedIndex !== null && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-bold text-accent"
                    >
                      {quizData.options[quizData.correctIndex]}
                    </motion.span>
                  )}
                </span>
              )}
            </React.Fragment>
          ))}
        </p>

        {/* Options */}
        <div className="space-y-3">
          {quizData.options.map((option, index) => {
            const isCorrect = index === quizData.correctIndex;
            const isSelected = index === selectedIndex;

            let borderColor = "#27272A";
            let bgColor = "transparent";
            let textColor = "#FAFAFA";

            if (showResult) {
              if (isCorrect) {
                borderColor = "#22C55E";
                bgColor = "rgba(34,197,94,0.15)";
                textColor = "#22C55E";
              } else if (isSelected && !isCorrect) {
                borderColor = "#EF4444";
                bgColor = "rgba(239,68,68,0.15)";
                textColor = "#EF4444";
              } else {
                textColor = "#A1A1AA";
              }
            }

            return (
              <motion.button
                key={index}
                whileHover={!showResult ? { scale: 1.02 } : {}}
                whileTap={!showResult ? { scale: 0.98 } : {}}
                onClick={() => handleSelect(index)}
                disabled={showResult}
                className="touch-target w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left"
                style={{
                  backgroundColor: bgColor,
                  borderColor,
                  color: textColor,
                }}
              >
                <span
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-body font-bold flex-shrink-0"
                  style={{
                    backgroundColor: isSelected || (showResult && isCorrect)
                      ? bgColor
                      : "rgba(39,39,42,0.5)",
                    color: textColor,
                  }}
                >
                  {optionLabels[index]}
                </span>
                <span className="font-body text-base">{option}</span>
                {showResult && isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto text-success text-lg"
                  >
                    ✓
                  </motion.span>
                )}
                {showResult && isSelected && !isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto text-error text-lg"
                  >
                    ✗
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Explanation */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-4 rounded-xl bg-bg/50 border border-border/50"
            >
              <p className="text-sm text-text-secondary mb-1">Wyjaśnienie:</p>
              <p className="text-base text-text-primary font-body">
                {quizData.explanationPL}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
