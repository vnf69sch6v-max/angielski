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
  const recAccuracy = session.recognitionAccuracy
    ? Math.round(session.recognitionAccuracy * 100)
    : null;
  const prodAccuracy = session.productionAccuracy
    ? Math.round(session.productionAccuracy * 100)
    : null;

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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-md overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-md glass-card p-6 sm:p-8 my-8"
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

            {/* V2: Dual-track accuracy */}
            {(recAccuracy !== null || prodAccuracy !== null) && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-xl font-body font-bold text-blue-400">
                    {recAccuracy ?? "—"}%
                  </p>
                  <p className="text-xs text-text-secondary">EN → PL</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                  <p className="text-xl font-body font-bold text-purple-400">
                    {prodAccuracy ?? "—"}%
                  </p>
                  <p className="text-xs text-text-secondary">PL → EN</p>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-bg/50 border border-border/50 text-center">
                <p className="text-2xl font-body font-bold text-text-primary">
                  {session.wordsReviewed}
                </p>
                <p className="text-xs text-text-secondary">
                  Słów powtórzonych
                </p>
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

            {/* V2: Fatigue data */}
            {session.fatigueData &&
              session.fatigueData.fatigueOnsetMinute !== null && (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 mb-4">
                  <p className="text-xs font-body text-warning/70 mb-1">
                    🧠 Zmęczenie
                  </p>
                  <p className="text-sm font-body text-text-primary">
                    Spadek efektywności od minuty{" "}
                    <span className="font-bold text-warning">
                      {session.fatigueData.fatigueOnsetMinute}
                    </span>
                  </p>
                  <p className="text-xs font-body text-text-secondary mt-1">
                    Celność:{" "}
                    {Math.round(session.fatigueData.accuracyBeforeFatigue * 100)}
                    % → {Math.round(session.fatigueData.accuracyAfterFatigue * 100)}
                    %
                  </p>
                </div>
              )}

            {/* V2: Leech words reviewed */}
            {session.leechWordsReviewed !== undefined &&
              session.leechWordsReviewed > 0 && (
                <div className="p-3 rounded-xl bg-error/10 border border-error/20 mb-4">
                  <p className="text-xs font-body text-error/70 mb-1">
                    🔴 Trudne słowa (pijawki)
                  </p>
                  <p className="text-sm font-body text-text-primary">
                    Powtórzono{" "}
                    <span className="font-bold text-error">
                      {session.leechWordsReviewed}
                    </span>{" "}
                    trudnych słów
                  </p>
                </div>
              )}

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
