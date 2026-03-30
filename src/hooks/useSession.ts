"use client";

import { useState, useCallback, useRef } from "react";
import { SessionItem, AnswerResult, ExerciseType, Domain, Session } from "@/lib/types";
import { generateId } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";

interface UseSessionReturn {
  // State
  sessionItems: SessionItem[];
  currentIndex: number;
  currentItem: SessionItem | null;
  isActive: boolean;
  isComplete: boolean;
  answers: AnswerResult[];
  sessionStartTime: number | null;

  // Actions
  startSession: (items: SessionItem[]) => void;
  submitAnswer: (result: AnswerResult) => void;
  nextItem: () => void;
  endSession: () => Session;
  resetSession: () => void;

  // Computed
  progress: number;
  totalItems: number;
  correctCount: number;
  accuracy: number;
}

export function useSession(): UseSessionReturn {
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const sessionStartTime = useRef<number | null>(null);

  const currentItem =
    isActive && currentIndex < sessionItems.length
      ? sessionItems[currentIndex]
      : null;

  const startSession = useCallback((items: SessionItem[]) => {
    setSessionItems(items);
    setCurrentIndex(0);
    setIsActive(true);
    setIsComplete(false);
    setAnswers([]);
    sessionStartTime.current = Date.now();
  }, []);

  const submitAnswer = useCallback(
    (result: AnswerResult) => {
      setAnswers((prev) => [...prev, result]);

      // Retry logic (Spec §4.5)
      if (!result.wasCorrect) {
        setSessionItems((prev) => {
          const item = prev[currentIndex];
          if (!item) return prev;

          // Count how many times this word is already in the session queue
          const appearances = prev.filter(
            (i) => i.wordProgress.wordId === result.wordId
          ).length;

          // Max 2 retries = 3 total appearances
          if (appearances < 3) {
            let nextExercise: ExerciseType = "flashcard";
            if (item.exerciseType === "translation") nextExercise = "quiz";
            else if (item.exerciseType === "quiz") nextExercise = "matching";
            else if (item.exerciseType === "matching") nextExercise = "flashcard";

            return [...prev, { ...item, exerciseType: nextExercise }];
          }
          return prev;
        });
      }
    },
    [currentIndex]
  );

  const nextItem = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= sessionItems.length) {
        setIsComplete(true);
        return prev;
      }
      return next;
    });
  }, [sessionItems.length]);

  const endSession = useCallback((): Session => {
    setIsActive(false);
    setIsComplete(true);

    const durationMs = sessionStartTime.current
      ? Date.now() - sessionStartTime.current
      : 0;

    const correctCount = answers.filter((a) => a.wasCorrect).length;
    const accuracyOverall =
      answers.length > 0 ? correctCount / answers.length : 0;

    // Calculate accuracy by domain
    const domainAccuracy: Record<Domain, { correct: number; total: number }> = {
      finance: { correct: 0, total: 0 },
      legal: { correct: 0, total: 0 },
      smalltalk: { correct: 0, total: 0 },
      tech: { correct: 0, total: 0 },
    };

    answers.forEach((answer, idx) => {
      if (idx < sessionItems.length) {
        const domain = sessionItems[idx].wordProgress.domain;
        domainAccuracy[domain].total++;
        if (answer.wasCorrect) domainAccuracy[domain].correct++;
      }
    });

    const accuracyByDomain: Record<Domain, number> = {
      finance:
        domainAccuracy.finance.total > 0
          ? domainAccuracy.finance.correct / domainAccuracy.finance.total
          : 0,
      legal:
        domainAccuracy.legal.total > 0
          ? domainAccuracy.legal.correct / domainAccuracy.legal.total
          : 0,
      smalltalk:
        domainAccuracy.smalltalk.total > 0
          ? domainAccuracy.smalltalk.correct / domainAccuracy.smalltalk.total
          : 0,
      tech:
        domainAccuracy.tech.total > 0
          ? domainAccuracy.tech.correct / domainAccuracy.tech.total
          : 0,
    };

    // Exercise breakdown
    const exerciseBreakdown: Record<ExerciseType, number> = {
      flashcard: 0,
      matching: 0,
      quiz: 0,
      translation: 0,
    };

    sessionItems.forEach((item) => {
      exerciseBreakdown[item.exerciseType]++;
    });

    // Wrong words
    const wrongWords = answers
      .filter((a) => !a.wasCorrect)
      .map((a) => {
        const item = sessionItems.find(
          (si) => si.wordProgress.wordId === a.wordId
        );
        return {
          wordId: a.wordId,
          word: item?.wordProgress.word || "",
          exercise: a.exerciseType,
        };
      });

    // Count new words
    const newWordsIntroduced = sessionItems.filter(
      (item) => item.wordProgress.state === "new"
    ).length;

    return {
      sessionId: generateId(),
      date: Timestamp.now(),
      durationMs,
      wordsReviewed: answers.length,
      newWordsIntroduced,
      accuracyOverall,
      accuracyByDomain,
      wrongWords,
      exerciseBreakdown,
      aiAnalysis: null,
    };
  }, [answers, sessionItems]);

  const resetSession = useCallback(() => {
    setSessionItems([]);
    setCurrentIndex(0);
    setIsActive(false);
    setIsComplete(false);
    setAnswers([]);
    sessionStartTime.current = null;
  }, []);

  const correctCount = answers.filter((a) => a.wasCorrect).length;

  return {
    sessionItems,
    currentIndex,
    currentItem,
    isActive,
    isComplete,
    answers,
    sessionStartTime: sessionStartTime.current,
    startSession,
    submitAnswer,
    nextItem,
    endSession,
    resetSession,
    progress:
      sessionItems.length > 0 ? (currentIndex / sessionItems.length) * 100 : 0,
    totalItems: sessionItems.length,
    correctCount,
    accuracy: answers.length > 0 ? correctCount / answers.length : 0,
  };
}
