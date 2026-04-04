"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSession } from "@/hooks/useSession";
import {
  getAllWordProgress,
  updateWordProgress,
  saveSession,
  updateUserProfile,
  updateSession,
} from "@/lib/firebase";
import { buildSession, getNextContinuationBatch, getNextPriority } from "@/lib/algorithm/session-engine";
import { scoreAnswer } from "@/lib/algorithm/scoring";
import { reviewWord } from "@/lib/algorithm/fsrs-engine";
import { updateExerciseLevel } from "@/lib/algorithm/escalator";
import { updateLeechStatus } from "@/lib/algorithm/leech";
import { migrateWordToV2, needsMigration } from "@/lib/algorithm/migration";
import {
  AnswerResult,
  QuizData,
  WordProgress,
  Session,
  ContextProductionEval,
} from "@/lib/types";
import {
  generateQuiz,
  resetCallCount,
  analyzeSession,
  generateMnemonic,
  generateContextScenario,
  evaluateContextProduction,
} from "@/lib/ai/gemini";
import FlashCard from "@/components/cards/FlashCard";
import QuizCard from "@/components/cards/QuizCard";
import MatchingCard from "@/components/cards/MatchingCard";
import TranslationCard from "@/components/cards/TranslationCard";
import ReverseTypingCard from "@/components/cards/ReverseTypingCard";
import ListeningCard from "@/components/cards/ListeningCard";
import ContextProductionCard from "@/components/cards/ContextProductionCard";
import SessionSummary from "@/components/layout/SessionSummary";
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

// Timer hook
function useTimer(isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isActive) return;
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  return { elapsed, display: `${minutes}:${seconds.toString().padStart(2, "0")}` };
}

export default function LearnPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const session = useSession(profile?.settings?.fatigueSensitivity || "medium");
  const timer = useTimer(session.isActive);
  const [isReady, setIsReady] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastWasCorrect, setLastWasCorrect] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionResult, setSessionResult] = useState<Session | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [allWordsRef, setAllWordsRef] = useState<WordProgress[]>([]);
  const [newWordsToday, setNewWordsToday] = useState(0);
  const continuationIndexRef = useRef(0);

  // V2: Context production state
  const [contextScenario, setContextScenario] = useState<string | null>(null);
  const [contextEvaluation, setContextEvaluation] = useState<ContextProductionEval | null>(null);
  const [isEvaluatingContext, setIsEvaluatingContext] = useState(false);

  // V2: Fatigue 5-minute timer
  const [fiveMinTimer, setFiveMinTimer] = useState<number | null>(null);

  // Load words and start session
  useEffect(() => {
    if (!user || loading) return;

    const initSession = async () => {
      try {
        let allWords = await getAllWordProgress(user.uid);

        if (allWords.length === 0) {
          router.push("/");
          return;
        }

        // V2: Auto-migrate words
        const needsMig = allWords.some(needsMigration);
        if (needsMig) {
          allWords = allWords.map((w) =>
            needsMigration(w) ? migrateWordToV2(w) : w
          );
          // Save migrated words back (fire-and-forget)
          for (const w of allWords) {
            if (w.tracks) {
              updateWordProgress(user.uid, w.wordId, {
                tracks: w.tracks,
                overallMastery: w.overallMastery,
                isLeech: w.isLeech || false,
                leechTrack: w.leechTrack || null,
              }).catch(console.error);
            }
          }
        }

        setAllWordsRef(allWords);

        const newPool = allWords.filter((w) => w.state === "new");
        const activeWords = allWords.filter((w) => w.state !== "new");
        const sessionItems = buildSession(activeWords, newPool, null);

        if (sessionItems.length === 0) {
          const { getSessionWords } = await import(
            "@/lib/algorithm/placeholder"
          );
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

  // Pre-fetch quiz from Gemini
  useEffect(() => {
    const item = session.currentItem;
    if (!item || item.exerciseType !== "quiz" || currentQuiz) return;

    if (item.wordProgress.quizCache) {
      setCurrentQuiz(item.wordProgress.quizCache);
      return;
    }

    generateQuiz(
      item.wordProgress.word,
      item.wordProgress.translation,
      item.wordProgress.domain
    )
      .then((quiz) => {
        const finalQuiz = quiz || generateFallbackQuiz(item.wordProgress);
        setCurrentQuiz(finalQuiz);

        if (quiz && user) {
          item.wordProgress.quizCache = quiz;
          updateWordProgress(user.uid, item.wordProgress.wordId, {
            quizCache: quiz,
          }).catch(console.error);
        }
      })
      .catch(() => {
        setCurrentQuiz(generateFallbackQuiz(item.wordProgress));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.currentItem, session.currentIndex]);

  // V2: Pre-fetch context scenario
  useEffect(() => {
    const item = session.currentItem;
    if (!item || item.exerciseType !== "context_production") return;

    setContextEvaluation(null);
    setIsEvaluatingContext(false);

    if (item.wordProgress.contextCache) {
      setContextScenario(item.wordProgress.contextCache);
      return;
    }

    generateContextScenario(
      item.wordProgress.word,
      item.wordProgress.translation,
      item.wordProgress.domain
    )
      .then((scenario) => {
        setContextScenario(scenario || "Napisz dowolne zdanie używając tego słowa.");

        if (scenario && user) {
          updateWordProgress(user.uid, item.wordProgress.wordId, {
            contextCache: scenario,
          }).catch(console.error);
        }
      })
      .catch(() => {
        setContextScenario("Napisz dowolne zdanie używając tego słowa.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.currentItem, session.currentIndex]);

  // V2: Handle continuation phase
  useEffect(() => {
    if (!session.isContinuationPhase || !session.isActive) return;

    const { priority, nextIndex } = getNextPriority(continuationIndexRef.current);
    continuationIndexRef.current = nextIndex;

    const newPool = allWordsRef.filter((w) => w.state === "new");
    const batch = getNextContinuationBatch(
      allWordsRef,
      session.fatigueTracker,
      priority,
      newWordsToday,
      newPool,
      profile?.settings?.dailyNewWordCap || 50
    );

    if (batch.length > 0) {
      if (priority === "new_words") {
        setNewWordsToday((prev) => prev + batch.length);
      }
      session.addItems(batch);
    } else {
      // Try next priority
      const next = getNextPriority(continuationIndexRef.current);
      continuationIndexRef.current = next.nextIndex;
      const batch2 = getNextContinuationBatch(
        allWordsRef,
        session.fatigueTracker,
        next.priority,
        newWordsToday,
        newPool,
        profile?.settings?.dailyNewWordCap || 50
      );
      if (batch2.length > 0) {
        session.addItems(batch2);
      }
      // If still nothing, session will show "End session" prompt
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isContinuationPhase]);

  // V2: 5-minute timer for fatigue red zone
  useEffect(() => {
    if (fiveMinTimer === null) return;
    const timeout = setTimeout(() => {
      handleEndSession();
    }, 5 * 60 * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiveMinTimer]);

  const handleAnswer = useCallback(
    async (wasCorrect: boolean, rating: number, responseTimeMs: number) => {
      if (!user || !session.currentItem) return;

      const answer: AnswerResult = {
        wordId: session.currentItem.wordProgress.wordId,
        exerciseType: session.currentItem.exerciseType,
        wasCorrect,
        rawRating: rating,
        responseTimeMs,
        trackDirection: session.currentItem.trackDirection,
      };

      session.submitAnswer(answer);
      setLastWasCorrect(wasCorrect);
      setShowFeedback(true);

      // FSRS scheduling
      const fsrsRating = scoreAnswer(
        session.currentItem.exerciseType,
        rating,
        responseTimeMs
      );
      let updatedWord = reviewWord(
        session.currentItem.wordProgress,
        fsrsRating
      );
      updatedWord = updateExerciseLevel(updatedWord, wasCorrect);
      updatedWord = updateLeechStatus(updatedWord);

      try {
        await updateWordProgress(
          user.uid,
          session.currentItem.wordProgress.wordId,
          updatedWord
        );
      } catch (err) {
        console.error("Failed to update word progress:", err);
      }
    },
    [user, session]
  );

  const handleEndSession = useCallback(() => {
    const result = session.endSession();
    setSessionResult(result);
    setShowSummary(true);

    if (user) {
      saveSession(user.uid, result).catch(console.error);

      updateUserProfile(user.uid, {
        lastSessionDate: Timestamp.now(),
        streakDays: (profile?.streakDays || 0) + 1,
      }).catch(console.error);

      analyzeSession({
        accuracyOverall: result.accuracyOverall,
        accuracyByDomain: result.accuracyByDomain,
        wrongWords: result.wrongWords,
        duration: result.durationMs,
        wordsReviewed: result.wordsReviewed,
      })
        .then(async (analysis) => {
          if (analysis) {
            updateSession(user.uid, result.sessionId, {
              aiAnalysis: {
                weakDomains: analysis.weakDomains,
                sessionQuality: analysis.sessionQuality,
                suggestions: analysis.suggestionPL,
              },
            }).catch(console.error);

            for (const wordStr of analysis.wordsNeedingMnemonics || []) {
              const matchingItem = session.sessionItems.find(
                (si) =>
                  si.wordProgress.word === wordStr &&
                  si.wordProgress.timesWrongTotal >= 3
              );
              if (matchingItem && !matchingItem.wordProgress.mnemonic) {
                const mnemonic = await generateMnemonic(
                  matchingItem.wordProgress.word,
                  matchingItem.wordProgress.translation,
                  matchingItem.wordProgress.timesWrongTotal
                );
                if (mnemonic) {
                  updateWordProgress(
                    user.uid,
                    matchingItem.wordProgress.wordId,
                    { mnemonic }
                  ).catch(console.error);
                }
              }
            }
          }
        })
        .catch(console.error);
    }
  }, [session, user, profile]);

  const handleNext = useCallback(() => {
    setShowFeedback(false);
    setCurrentQuiz(null);
    setContextScenario(null);
    setContextEvaluation(null);

    if (session.currentIndex >= session.totalItems - 1) {
      // Don't auto-end — continuation will handle it
      session.nextItem();
    } else {
      session.nextItem();
    }
  }, [session]);

  // Exercise handlers
  const handleFlashCardAnswer = (
    rating: 1 | 2 | 3 | 4,
    responseTimeMs: number
  ) => {
    handleAnswer(rating >= 3, rating, responseTimeMs);
  };

  const handleQuizAnswer = (wasCorrect: boolean, responseTimeMs: number) => {
    handleAnswer(wasCorrect, wasCorrect ? 3 : 1, responseTimeMs);
  };

  const handleMatchingAnswer = (
    correctCount: number,
    responseTimeMs: number
  ) => {
    handleAnswer(correctCount >= 4, correctCount >= 4 ? 3 : 1, responseTimeMs);
  };

  const handleTranslationAnswer = (
    score: number,
    responseTimeMs: number
  ) => {
    const wasCorrect = score >= 65;
    const rating = score >= 90 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : 1;
    handleAnswer(wasCorrect, rating, responseTimeMs);
  };

  const handleReverseTypingAnswer = (
    rating: 1 | 2 | 3 | 4,
    responseTimeMs: number
  ) => {
    handleAnswer(rating >= 3, rating, responseTimeMs);
  };

  const handleListeningAnswer = (
    rating: 1 | 2 | 3 | 4,
    responseTimeMs: number
  ) => {
    handleAnswer(rating >= 3, rating, responseTimeMs);
  };

  const handleContextProductionSubmit = useCallback(
    async (sentence: string) => {
      if (!session.currentItem || !contextScenario) return;
      setIsEvaluatingContext(true);

      const evaluation = await evaluateContextProduction(
        session.currentItem.wordProgress.word,
        contextScenario,
        sentence
      );

      if (evaluation) {
        setContextEvaluation(evaluation);
        // handleAnswer will be called from the card's useEffect when evaluation arrives
      } else {
        // Fallback: give midrange score
        setContextEvaluation({
          wordUsed: 15,
          grammar: 20,
          naturalness: 15,
          totalScore: 50,
          feedbackPL: "Nie udało się ocenić odpowiedzi automatycznie.",
        });
      }
      setIsEvaluatingContext(false);
    },
    [session.currentItem, contextScenario]
  );

  const handleContextAnswer = (score: number, responseTimeMs: number) => {
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
  const fl = session.fatigueLevel;
  const accuracyStats = session.fatigueTracker.getAccuracyStats();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* V2: Fatigue banners */}
      <AnimatePresence>
        {fl === "orange" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-warning/10 border-b border-warning/30 px-4 py-3"
          >
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-warning text-sm">⚠️</span>
                <div>
                  <p className="text-sm font-body text-warning font-medium">
                    Twoja efektywność spada
                  </p>
                  {accuracyStats && (
                    <p className="text-xs font-body text-warning/70">
                      Celność: {accuracyStats.baseline}% → {accuracyStats.current}%
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleEndSession}
                className="text-xs px-3 py-1.5 rounded-lg bg-warning/20 text-warning font-body hover:bg-warning/30 transition-all"
              >
                Zakończ
              </button>
            </div>
          </motion.div>
        )}

        {fl === "red" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-error/10 border-b border-error/30 px-4 py-3"
          >
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-error text-sm">🧠</span>
                <div>
                  <p className="text-sm font-body text-error font-medium">
                    Twój mózg potrzebuje przerwy!
                  </p>
                  <p className="text-xs font-body text-error/70">
                    Nowe słowa nie będą zapamiętane w tym stanie.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFiveMinTimer(Date.now())}
                  className="text-xs px-3 py-1.5 rounded-lg bg-error/20 text-error font-body hover:bg-error/30 transition-all"
                >
                  Jeszcze 5 min
                </button>
                <button
                  onClick={handleEndSession}
                  className="text-xs px-3 py-1.5 rounded-lg bg-error text-white font-body hover:bg-error/90 transition-all"
                >
                  Zakończ
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar — V2: Timer instead of progress bar */}
      <div className="sticky top-0 z-40 bg-bg/95 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={handleEndSession}
            className="touch-target px-3 py-1.5 rounded-xl bg-bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-error/50 hover:text-error transition-all text-sm font-body"
          >
            Zakończ
          </button>

          <div className="flex items-center gap-3">
            {/* Fatigue indicator dot */}
            <div
              className="w-2.5 h-2.5 rounded-full transition-colors"
              style={{
                backgroundColor:
                  fl === "green"
                    ? "#22C55E"
                    : fl === "yellow"
                    ? "#F59E0B"
                    : fl === "orange"
                    ? "#F97316"
                    : "#EF4444",
              }}
              title={`Zmęczenie: ${Math.round(session.fatigueScore * 100)}%`}
            />

            {/* Timer */}
            <span className="text-sm font-mono text-text-secondary">
              {timer.display}
            </span>

            {/* Word counter */}
            <span className="text-sm font-body text-text-secondary">
              {session.currentIndex + 1}/{session.totalItems}
            </span>
          </div>
        </div>
      </div>

      {/* Exercise area */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Continuation phase — waiting for new batch */}
          {session.isContinuationPhase && !currentItem && !showFeedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-lg mx-auto text-center glass-card p-8"
            >
              <p className="text-4xl mb-4">🎯</p>
              <h3 className="text-xl font-heading text-text-primary mb-2">
                Zaległości zrobione!
              </h3>
              <p className="text-sm text-text-secondary font-body mb-6">
                Nie masz więcej słów do powtórki. Gratulacje!
              </p>
              <button
                onClick={handleEndSession}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-body font-medium transition-all"
              >
                Zakończ sesję
              </button>
            </motion.div>
          )}

          {currentItem && !showFeedback && (
            <motion.div
              key={`${currentItem.wordProgress.wordId}-${currentItem.exerciseType}-${session.currentIndex}`}
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

              {currentItem.exerciseType === "reverse_typing" && (
                <ReverseTypingCard
                  wordProgress={currentItem.wordProgress}
                  onAnswer={handleReverseTypingAnswer}
                />
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

              {currentItem.exerciseType === "listening" && (
                <ListeningCard
                  wordProgress={currentItem.wordProgress}
                  onAnswer={handleListeningAnswer}
                  onFallbackToQuiz={() => {
                    // Fallback: switch this item to quiz
                    setCurrentQuiz(
                      currentItem.wordProgress.quizCache ||
                        generateFallbackQuiz(currentItem.wordProgress)
                    );
                  }}
                />
              )}

              {currentItem.exerciseType === "quiz" &&
                (currentQuiz ? (
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
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                        className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full mx-auto mb-3"
                      />
                      <p className="text-sm text-text-secondary font-body">
                        Generuję quiz z AI...
                      </p>
                    </div>
                  </div>
                ))}

              {currentItem.exerciseType === "translation" && (
                <TranslationCard
                  wordProgress={currentItem.wordProgress}
                  polishSentence={`Przetłumacz: "${currentItem.wordProgress.translation}" w kontekście zdania.`}
                  onAnswer={handleTranslationAnswer}
                />
              )}

              {currentItem.exerciseType === "context_production" && (
                <ContextProductionCard
                  wordProgress={currentItem.wordProgress}
                  scenario={contextScenario}
                  onAnswer={handleContextAnswer}
                  evaluation={contextEvaluation}
                  isEvaluating={isEvaluatingContext}
                  onSubmitForEvaluation={handleContextProductionSubmit}
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
                  {currentItem.wordProgress.word} —{" "}
                  {currentItem.wordProgress.translation}
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
