"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Session } from "@/lib/types";
import Button from "@/components/ui/Button";
import Link from "next/link";

interface SessionSummaryProps {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
}

export default function SessionSummary({
  session,
  isOpen,
  onClose,
}: SessionSummaryProps) {
  const accuracyPercent = Math.round(session.accuracyOverall * 100);
  const durationMinutes = Math.round(session.durationMs / 60000);

  const getAccuracyColor = () => {
    if (accuracyPercent >= 80) return "#22C55E";
    if (accuracyPercent >= 60) return "#F59E0B";
    return "#EF4444";
  };

  const getAccuracyLabel = () => {
    if (accuracyPercent >= 90) return "Doskonale! 🌟";
    if (accuracyPercent >= 80) return "Świetnie! 🎉";
    if (accuracyPercent >= 60) return "Dobrze! 💪";
    return "Ćwicz dalej! 📚";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-md glass-card p-6 sm:p-8"
          >
            <h2 className="text-2xl font-heading text-text-primary text-center mb-6">
              Podsumowanie sesji
            </h2>

            {/* Score circle */}
            <div className="flex justify-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                className="w-28 h-28 rounded-full flex flex-col items-center justify-center border-4"
                style={{
                  borderColor: getAccuracyColor(),
                  backgroundColor: `${getAccuracyColor()}15`,
                }}
              >
                <span
                  className="text-3xl font-body font-bold"
                  style={{ color: getAccuracyColor() }}
                >
                  {accuracyPercent}%
                </span>
                <span className="text-xs text-text-secondary">celność</span>
              </motion.div>
            </div>

            <p className="text-center text-lg font-body text-text-primary mb-6">
              {getAccuracyLabel()}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-bg/50 border border-border/50 text-center">
                <p className="text-2xl font-body font-bold text-text-primary">
                  {session.wordsReviewed}
                </p>
                <p className="text-xs text-text-secondary">Słów powtórzonych</p>
              </div>
              <div className="p-3 rounded-xl bg-bg/50 border border-border/50 text-center">
                <p className="text-2xl font-body font-bold text-accent">
                  {session.newWordsIntroduced}
                </p>
                <p className="text-xs text-text-secondary">Nowych słów</p>
              </div>
              <div className="p-3 rounded-xl bg-bg/50 border border-border/50 text-center">
                <p className="text-2xl font-body font-bold text-text-primary">
                  {durationMinutes} min
                </p>
                <p className="text-xs text-text-secondary">Czas nauki</p>
              </div>
              <div className="p-3 rounded-xl bg-bg/50 border border-border/50 text-center">
                <p className="text-2xl font-body font-bold text-error">
                  {session.wrongWords.length}
                </p>
                <p className="text-xs text-text-secondary">Błędów</p>
              </div>
            </div>

            {/* Wrong words list */}
            {session.wrongWords.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-body text-text-secondary mb-2">
                  Słowa do poprawy:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {session.wrongWords.map((ww, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg bg-error-muted border border-error/20"
                    >
                      <span className="text-error text-xs">✗</span>
                      <span className="text-sm font-body text-text-primary">
                        {ww.word}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <Link href="/" className="block">
              <Button fullWidth size="lg" onClick={onClose}>
                Wróć do dashboardu
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
