"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSession } from "@/hooks/useSession";
import { getAllWordProgress, updateWordProgress, saveSession, updateUserProfile } from "@/lib/firebase";
import { buildSession } from "@/lib/algorithm/session-engine";
import { scoreAnswer } from "@/lib/algorithm/scoring";
import { reviewWord } from "@/lib/algorithm/fsrs-engine";
import { updateExerciseLevel } from "@/lib/algorithm/escalator";
import { AnswerResult, QuizData, WordProgress, Session } from "@/lib/types";
import { generateQuiz, resetCallCount, analyzeSession } from "@/lib/ai/gemini";
import FlashCard from "@/components/cards/FlashCard";
import QuizCard from "@/components/cards/QuizCard";
import MatchingCard from "@/components/cards/MatchingCard";
import TranslationCard from "@/components/cards/TranslationCard";
import SessionSummary from "@/components/layout/SessionSummary";
import ProgressBar from "@/components/ui/ProgressBar";
import { Timestamp } from "firebase/firestore";

// Fallback quiz data when AI is unavailable
function generateFallbackQuiz(word: WordProgress): QuizData {
  const distractors = ["increase", "decrease", "maintain", "eliminate"];
  const options = [word.word, ...distractors.slice(0, 3)].sort(
    () => Math.random() - 0.5
  );
  const correctIndex = options.indexOf(word.word);

  return {
    sentence: `In this context, we need to ___ the current approach.`,
    options,
    correctIndex,
    explanationPL: `Poprawna odpowiedź to "${word.word}" (${word.translation}), ponieważ najlepiej pasuje do kontekstu zdania.`,
  };
}

export default function LearnPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const session = useSession();
  const [isReady, setIsReady] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastWasCorrect, setLastWasCorrect] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionResult, setSessionResult] = useState<Session | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);

  // Load words and start session
  useEffect(() => {
    if (!user || loading) return;

    const initSession = async () => {
      try {
        const allWords = await getAllWordProgress(user.uid);

        if (allWords.length === 0) {
          // No words seeded yet — redirect to dashboard
          router.push("/");
          return;
        }

        // Use real session engine with FSRS algorithm
        const newPool = allWords.filter((w) => w.state === "new");
        const activeWords = allWords.filter((w) => w.state !== "new");
        const sessionItems = buildSession(activeWords, newPool, null);

        // Fallback: if no items from algorithm (all new, no reviews), use placeholder
        if (sessionItems.length === 0) {
          const { getSessionWords } = await import("@/lib/algorithm/placeholder");
          const fallbackItems = getSessionWords(allWords);
          resetCallCount();
          session.startSession(fallbackItems);
        } else {
          resetCallCount();
          session.startSession(sessionItems);
        }
        setIsReady(true);
      } catch (err) {
        console.error("Failed to init session:", err);
        router.push("/");
      }
    };

    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Pre-fetch quiz from Gemini when current exercise is a quiz
  useEffect(() => {
    const item = session.currentItem;
    if (!item || item.exerciseType !== "quiz" || currentQuiz) return;

    if (item.wordProgress.quizCache) {
      setCurrentQuiz(item.wordProgress.quizCache);
      return;
    }

    generateQuiz(item.wordProgress.word, item.wordProgress.translation, item.wordProgress.domain)
      .then((quiz) => {
        const finalQuiz = quiz || generateFallbackQuiz(item.wordProgress);
        setCurrentQuiz(finalQuiz);

        // Zapamiętaj quiz w bazie na zawsze
        if (quiz && user) {
          item.wordProgress.quizCache = quiz; // update local session cache
          updateWordProgress(user.uid, item.wordProgress.wordId, { quizCache: quiz }).catch(console.error);
        }
      })
      .catch(() => {
        setCurrentQuiz(generateFallbackQuiz(item.wordProgress));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.currentItem, session.currentIndex]);

  const handleAnswer = useCallback(
    async (wasCorrect: boolean, rating: number, responseTimeMs: number) => {
      if (!user || !session.currentItem) return;

      const answer: AnswerResult = {
        wordId: session.currentItem.wordProgress.wordId,
        exerciseType: session.currentItem.exerciseType,
        wasCorrect,
        rawRating: rating,
        responseTimeMs,
      };

      session.submitAnswer(answer);
      setLastWasCorrect(wasCorrect);
      setShowFeedback(true);

      // Use FSRS Engine for proper spaced repetition scheduling
      const fsrsRating = scoreAnswer(
        session.currentItem.exerciseType,
        rating,
        responseTimeMs
      );
      const updatedWord = reviewWord(session.currentItem.wordProgress, fsrsRating);
      const afterEscalation = updateExerciseLevel(updatedWord, wasCorrect);

      try {
        await updateWordProgress(
          user.uid,
          session.currentItem.wordProgress.wordId,
          afterEscalation
        );
      } catch (err) {
        console.error("Failed to update word progress:", err);
      }
    },
    [user, session]
  );

  const handleNext = useCallback(() => {
    setShowFeedback(false);
    setCurrentQuiz(null);

    if (session.currentIndex >= session.totalItems - 1) {
      // Session complete
      const result = session.endSession();
      setSessionResult(result);
      setShowSummary(true);

      // Save session to Firestore
      if (user) {
        saveSession(user.uid, result).catch(console.error);

        // Update streak
        updateUserProfile(user.uid, {
          lastSessionDate: Timestamp.now(),
          streakDays: (profile?.streakDays || 0) + 1,
        }).catch(console.error);

        // AI session analysis
        analyzeSession({
          accuracyOverall: result.accuracyOverall,
          accuracyByDomain: result.accuracyByDomain,
          wrongWords: result.wrongWords,
          duration: result.durationMs,
          wordsReviewed: result.wordsReviewed,
        }).then((analysis) => {
          if (analysis) {
            console.log("Session analysis:", analysis);
          }
        }).catch(console.error);
      }
    } else {
      session.nextItem();
    }
  }, [session, user, profile]);

  const handleFlashCardAnswer = (rating: 1 | 2 | 3 | 4, responseTimeMs: number) => {
    const wasCorrect = rating >= 3;
    handleAnswer(wasCorrect, rating, responseTimeMs);
  };

  const handleQuizAnswer = (wasCorrect: boolean, responseTimeMs: number) => {
    handleAnswer(wasCorrect, wasCorrect ? 3 : 1, responseTimeMs);
  };

  const handleMatchingAnswer = (correctCount: number, responseTimeMs: number) => {
    const wasCorrect = correctCount >= 4;
    handleAnswer(wasCorrect, wasCorrect ? 3 : 1, responseTimeMs);
  };

  const handleTranslationAnswer = (score: number, responseTimeMs: number) => {
    const wasCorrect = score >= 65;
    const rating = score >= 90 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : 1;
    handleAnswer(wasCorrect, rating, responseTimeMs);
  };

  if (loading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full mx-auto mb-4"
          />
          <p className="text-sm font-body text-text-secondary">
            Przygotowuję sesję...
          </p>
        </div>
      </div>
    );
  }

  const currentItem = session.currentItem;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-bg/95 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="touch-target p-2 rounded-xl hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <ProgressBar
            value={(session.currentIndex / session.totalItems) * 100}
            height={6}
            className="flex-1"
          />
          <span className="text-sm font-body text-text-secondary whitespace-nowrap">
            {session.currentIndex + 1}/{session.totalItems}
          </span>
        </div>
      </div>

      {/* Exercise area */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">
          {currentItem && !showFeedback && (
            <motion.div
              key={`${currentItem.wordProgress.wordId}-${currentItem.exerciseType}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {currentItem.exerciseType === "flashcard" && (
                <FlashCard
                  wordProgress={currentItem.wordProgress}
                  onAnswer={handleFlashCardAnswer}
                />
              )}

              {currentItem.exerciseType === "quiz" && (
                currentQuiz ? (
                  <QuizCard
                    wordProgress={currentItem.wordProgress}
                    quizData={currentQuiz}
                    onAnswer={handleQuizAnswer}
                  />
                ) : (
                  <div className="w-full max-w-lg mx-auto">
                    <div className="glass-card p-8 text-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full mx-auto mb-3"
                      />
                      <p className="text-sm text-text-secondary font-body">Generuję quiz z AI...</p>
                    </div>
                  </div>
                )
              )}

              {currentItem.exerciseType === "matching" && (
                <MatchingCard
                  pairs={session.sessionItems
                    .slice(
                      session.currentIndex,
                      Math.min(session.currentIndex + 5, session.totalItems)
                    )
                    .map((item) => ({
                      wordId: item.wordProgress.wordId,
                      word: item.wordProgress.word,
                      translation: item.wordProgress.translation,
                    }))}
                  onAnswer={handleMatchingAnswer}
                />
              )}

              {currentItem.exerciseType === "translation" && (
                <TranslationCard
                  wordProgress={currentItem.wordProgress}
                  polishSentence={`Przetłumacz: "${currentItem.wordProgress.translation}" w kontekście zdania.`}
                  onAnswer={handleTranslationAnswer}
                />
              )}
            </motion.div>
          )}

          {/* Feedback overlay */}
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg mx-auto text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  lastWasCorrect
                    ? "bg-success-muted border-2 border-success"
                    : "bg-error-muted border-2 border-error"
                }`}
              >
                <span className="text-3xl">
                  {lastWasCorrect ? "✓" : "✗"}
                </span>
              </motion.div>
              <p
                className={`text-xl font-heading mb-2 ${
                  lastWasCorrect ? "text-success" : "text-error"
                }`}
              >
                {lastWasCorrect ? "Dobrze!" : "Spróbuj ponownie"}
              </p>
              {currentItem && (
                <p className="text-sm text-text-secondary font-body mb-6">
                  {currentItem.wordProgress.word} — {currentItem.wordProgress.translation}
                </p>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className="touch-target px-8 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-body font-medium transition-all"
              >
                Dalej →
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session summary */}
      {sessionResult && (
        <SessionSummary
          session={sessionResult}
          isOpen={showSummary}
          onClose={() => {
            setShowSummary(false);
            router.push("/");
          }}
        />
      )}
    </div>
  );
}
