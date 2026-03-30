"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress, TranslationEval } from "@/lib/types";
import Button from "@/components/ui/Button";
import DomainTag from "@/components/ui/DomainTag";

interface TranslationCardProps {
  wordProgress: WordProgress;
  polishSentence: string;
  onAnswer: (score: number, responseTimeMs: number) => void;
}

export default function TranslationCard({
  wordProgress,
  polishSentence,
  onAnswer,
}: TranslationCardProps) {
  const [userInput, setUserInput] = useState("");
  const [evaluation, setEvaluation] = useState<TranslationEval | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const startTime = useRef(Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    startTime.current = Date.now();
    setUserInput("");
    setEvaluation(null);
    setIsSubmitted(false);
    setIsLoading(false);
    inputRef.current?.focus();
  }, [wordProgress.wordId]);

  const handleSubmit = async () => {
    if (!userInput.trim() || isSubmitted) return;

    setIsLoading(true);
    const responseTime = Date.now() - startTime.current;

    try {
      // Try Gemini AI evaluation first
      const { evaluateTranslation } = await import("@/lib/ai/gemini");
      const aiEval = await evaluateTranslation(polishSentence, userInput.trim());

      if (aiEval) {
        setEvaluation(aiEval);
        setIsSubmitted(true);
        setIsLoading(false);
        setTimeout(() => onAnswer(aiEval.score, responseTime), 3000);
        return;
      }
    } catch (err) {
      console.warn("AI evaluation failed, using fallback:", err);
    }

    // Fallback: simple string comparison scoring
    const target = wordProgress.word.toLowerCase();
    const input = userInput.trim().toLowerCase();
    const similarity = target === input ? 100 : target.includes(input) || input.includes(target) ? 70 : 40;

    const fallbackEval: TranslationEval = {
      score: similarity,
      feedbackPL: similarity >= 70
        ? "Dobrze! Twoje tłumaczenie jest bliskie oczekiwanemu."
        : "Spróbuj jeszcze raz. Zwróć uwagę na słownictwo i kontekst.",
      alternatives: [`${wordProgress.word} — ${wordProgress.translation}`],
    };

    setEvaluation(fallbackEval);
    setIsSubmitted(true);
    setIsLoading(false);
    setTimeout(() => onAnswer(fallbackEval.score, responseTime), 3000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#22C55E";
    if (score >= 65) return "#3B82F6";
    if (score >= 40) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="glass-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <DomainTag domain={wordProgress.domain} />
          <span className="text-xs font-body text-text-secondary">
            Przetłumacz zdanie
          </span>
        </div>

        {/* Polish sentence */}
        <div className="p-4 rounded-xl bg-bg/50 border border-border/50 mb-6">
          <p className="text-sm text-text-secondary mb-1">Po polsku:</p>
          <p className="text-lg sm:text-xl font-body text-text-primary leading-relaxed">
            {polishSentence}
          </p>
        </div>

        {/* Text input */}
        <div className="mb-4">
          <label className="text-sm font-body text-text-secondary mb-2 block">
            Twoje tłumaczenie po angielsku:
          </label>
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isSubmitted}
            placeholder="Type your translation here..."
            className="w-full p-4 rounded-xl bg-bg-surface border border-border text-text-primary font-body text-base
              placeholder:text-text-secondary/50 resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50
              disabled:opacity-50 transition-all duration-200"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {/* Submit button */}
        {!isSubmitted && (
          <Button
            onClick={handleSubmit}
            disabled={!userInput.trim() || isLoading}
            fullWidth
            size="lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Sprawdzam...
              </span>
            ) : (
              "Sprawdź"
            )}
          </Button>
        )}

        {/* Evaluation result */}
        <AnimatePresence>
          {evaluation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 space-y-4"
            >
              {/* Score */}
              <div className="flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="w-20 h-20 rounded-full flex items-center justify-center border-4"
                  style={{
                    borderColor: getScoreColor(evaluation.score),
                    backgroundColor: `${getScoreColor(evaluation.score)}15`,
                  }}
                >
                  <span
                    className="text-2xl font-body font-bold"
                    style={{ color: getScoreColor(evaluation.score) }}
                  >
                    {evaluation.score}
                  </span>
                </motion.div>
              </div>

              {/* Feedback */}
              <div className="p-4 rounded-xl bg-bg/50 border border-border/50">
                <p className="text-sm text-text-secondary mb-1">Ocena:</p>
                <p className="text-base text-text-primary font-body">
                  {evaluation.feedbackPL}
                </p>
              </div>

              {/* Alternatives */}
              {evaluation.alternatives.length > 0 && (
                <div className="p-4 rounded-xl bg-accent-muted border border-accent/20">
                  <p className="text-sm text-accent mb-1">Alternatywne tłumaczenia:</p>
                  {evaluation.alternatives.map((alt, i) => (
                    <p key={i} className="text-sm text-text-primary font-body mt-1">
                      • {alt}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
