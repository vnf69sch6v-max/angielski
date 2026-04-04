"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WordProgress } from "@/lib/types";
import DomainTag from "@/components/ui/DomainTag";

interface ContextProductionCardProps {
  wordProgress: WordProgress;
  scenario: string | null; // AI-generated scenario in Polish
  onAnswer: (score: number, responseTimeMs: number) => void;
  evaluation: {
    wordUsed: number;
    grammar: number;
    naturalness: number;
    totalScore: number;
    feedbackPL: string;
  } | null;
  isEvaluating: boolean;
  onSubmitForEvaluation: (sentence: string) => void;
}

export default function ContextProductionCard({
  wordProgress,
  scenario,
  onAnswer,
  evaluation,
  isEvaluating,
  onSubmitForEvaluation,
}: ContextProductionCardProps) {
  const [userInput, setUserInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const startTime = useRef(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    startTime.current = Date.now();
    setUserInput("");
    setSubmitted(false);
  }, [wordProgress.wordId]);

  // Auto-submit answer when evaluation comes back
  useEffect(() => {
    if (evaluation && submitted) {
      const responseTime = Date.now() - startTime.current;
      onAnswer(evaluation.totalScore, responseTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation]);

  const handleSubmit = () => {
    if (!userInput.trim() || submitted) return;
    setSubmitted(true);
    onSubmitForEvaluation(userInput.trim());
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22C55E";
    if (score >= 60) return "#3B82F6";
    if (score >= 40) return "#F59E0B";
    return "#EF4444";
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
          <span className="text-xs font-body text-text-secondary px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
            ✍️ Kontekst
          </span>
          <DomainTag domain={wordProgress.domain} />
        </div>

        {/* Target word */}
        <div className="text-center mb-4">
          <p className="text-sm font-body text-text-secondary mb-1">
            Użyj słowa:
          </p>
          <h2 className="text-3xl sm:text-4xl font-heading text-accent mb-1">
            {wordProgress.word}
          </h2>
          <p className="text-sm text-text-secondary font-body">
            {wordProgress.translation}
          </p>
        </div>

        {/* Scenario */}
        {scenario ? (
          <div className="p-4 rounded-xl bg-bg-surface border border-border mb-6">
            <p className="text-xs text-text-secondary font-body mb-1">
              📋 Scenariusz:
            </p>
            <p className="text-sm text-text-primary font-body leading-relaxed">
              {scenario}
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-bg-surface border border-border mb-6 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full mx-auto mb-2"
            />
            <p className="text-xs text-text-secondary font-body">
              Generuję scenariusz...
            </p>
          </div>
        )}

        {/* Input area */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary font-body block mb-2">
              Napisz 1-2 zdania po angielsku:
            </label>
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={submitted}
              placeholder="Write a sentence using the word above..."
              rows={3}
              className={`w-full px-4 py-3 rounded-xl font-body text-base resize-none transition-all duration-300
                ${
                  submitted
                    ? "bg-bg-surface/50 border border-border/50 text-text-secondary"
                    : "bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                }
                placeholder:text-text-secondary/40`}
            />
          </div>

          {/* Submit button */}
          {!submitted && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={!userInput.trim() || !scenario}
              className="w-full py-3.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40
                text-white font-body font-medium transition-all"
            >
              Sprawdź
            </motion.button>
          )}

          {/* Loading evaluation */}
          {isEvaluating && (
            <div className="p-4 rounded-xl bg-bg-surface border border-border text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full mx-auto mb-2"
              />
              <p className="text-xs text-text-secondary font-body">
                AI ocenia Twoje zdanie...
              </p>
            </div>
          )}

          {/* Evaluation result */}
          <AnimatePresence>
            {evaluation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3"
              >
                {/* Score breakdown */}
                <div className="p-4 rounded-xl bg-bg-surface border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-body text-text-secondary">
                      Wynik
                    </span>
                    <span
                      className="text-2xl font-heading font-bold"
                      style={{ color: getScoreColor(evaluation.totalScore) }}
                    >
                      {evaluation.totalScore}/100
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: "Użycie słowa", score: evaluation.wordUsed, max: 30 },
                      { label: "Gramatyka", score: evaluation.grammar, max: 40 },
                      { label: "Naturalność", score: evaluation.naturalness, max: 30 },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs font-body mb-1">
                          <span className="text-text-secondary">
                            {item.label}
                          </span>
                          <span className="text-text-primary">
                            {item.score}/{item.max}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(item.score / item.max) * 100}%`,
                            }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: getScoreColor(
                                (item.score / item.max) * 100
                              ),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI feedback */}
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <p className="text-xs text-accent/70 mb-1">
                    💬 Feedback AI:
                  </p>
                  <p className="text-sm text-text-primary font-body leading-relaxed">
                    {evaluation.feedbackPL}
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
