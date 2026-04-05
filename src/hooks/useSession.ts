"use client";

import { useState, useCallback, useRef } from "react";
import {
  SessionItem,
  AnswerResult,
  ExerciseType,
  Domain,
  Session,
  SessionFatigueData,
} from "@/lib/types";
import { generateId } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";
import { FatigueTracker, FatigueLevel } from "@/lib/algorithm/fatigue";
import { getTodayString, getHourOfDay, getDayOfWeek } from "@/lib/algorithm/data-pipeline";

interface UseSessionReturn {
  // State
  sessionItems: SessionItem[];
  currentIndex: number;
  currentItem: SessionItem | null;
  isActive: boolean;
  isComplete: boolean;
  answers: AnswerResult[];
  sessionStartTime: number | null;
  isContinuationPhase: boolean;

  // Actions
  startSession: (items: SessionItem[]) => void;
  submitAnswer: (result: AnswerResult) => void;
  nextItem: () => void;
  addItems: (items: SessionItem[]) => void;
  endSession: () => Session;
  resetSession: () => void;

  // Computed
  progress: number;
  totalItems: number;
  correctCount: number;
  accuracy: number;
  elapsedMs: number;

  // V2: Fatigue
  fatigueTracker: FatigueTracker;
  fatigueLevel: FatigueLevel;
  fatigueScore: number;
  fatigueData: SessionFatigueData | null;

  // V2: Track stats
  recognitionAccuracy: number;
  productionAccuracy: number;
  // V2: Record of seen items to avoid repetition
  seenWordIds: Set<string>;
}

export function useSession(fatigueSensitivity: "low" | "medium" | "high" = "medium"): UseSessionReturn {
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [isContinuationPhase, setIsContinuationPhase] = useState(false);
  const [fatigueLevel, setFatigueLevel] = useState<FatigueLevel>("green");
  const [fatigueScore, setFatigueScore] = useState(0);
  const sessionStartTime = useRef<number | null>(null);
  const fatigueTrackerRef = useRef(new FatigueTracker(fatigueSensitivity));
  const seenWordIds = useRef<Set<string>>(new Set());
  const sessionRetryMap = useRef<Map<string, number>>(new Map());

  const currentItem =
    isActive && currentIndex < sessionItems.length
      ? sessionItems[currentIndex]
      : null;

  const startSession = useCallback(
    (items: SessionItem[]) => {
      setSessionItems(items);
      setCurrentIndex(0);
      setIsActive(true);
      setIsComplete(false);
      setAnswers([]);
      setIsContinuationPhase(false);
      setFatigueLevel("green");
      setFatigueScore(0);
      sessionStartTime.current = Date.now();
      fatigueTrackerRef.current = new FatigueTracker(fatigueSensitivity);
      seenWordIds.current = new Set(items.map(i => i.wordProgress.wordId));
      sessionRetryMap.current = new Map();
    },
    [fatigueSensitivity]
  );

  const submitAnswer = useCallback(
    (result: AnswerResult) => {
      setAnswers((prev) => [...prev, result]);

      // Update fatigue tracker
      fatigueTrackerRef.current.addAnswer(
        result.wasCorrect,
        result.responseTimeMs
      );
      const newScore = fatigueTrackerRef.current.getFatigueScore();
      setFatigueScore(newScore);
      setFatigueLevel(fatigueTrackerRef.current.getFatigueLevel());

      // Retry logic (Spec §4.5) - now properly limited to max 1 retry per session per word
      if (!result.wasCorrect) {
        const currentRetryCount = sessionRetryMap.current.get(result.wordId) || 0;
        
        if (currentRetryCount < 1) { // MAX 1 RETRY!
          sessionRetryMap.current.set(result.wordId, currentRetryCount + 1);
          
          setSessionItems((prev) => {
            const item = prev[currentIndex];
            if (!item) return prev;

            let nextExercise: ExerciseType = "flashcard";
            if (item.exerciseType === "context_production")
              nextExercise = "translation";
            else if (item.exerciseType === "translation")
              nextExercise = "quiz";
            else if (item.exerciseType === "quiz") nextExercise = "matching";
            else if (item.exerciseType === "listening")
              nextExercise = "matching";
            else if (item.exerciseType === "matching")
              nextExercise = "reverse_typing";
            else if (item.exerciseType === "reverse_typing")
              nextExercise = "flashcard";

            return [
              ...prev,
              {
                ...item,
                exerciseType: nextExercise,
              },
            ];
          });
        }
      }
    },
    [currentIndex]
  );

  const nextItem = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= sessionItems.length) {
        // Don't auto-complete — enter continuation phase
        setIsContinuationPhase(true);
        return prev;
      }
      return next;
    });
  }, [sessionItems.length]);

  // V2: Add more items (continuation phase)
  const addItems = useCallback((items: SessionItem[]) => {
    if (items.length === 0) return;
    
    // Add new items to seen set to prevent them from being pulled again
    items.forEach(i => seenWordIds.current.add(i.wordProgress.wordId));
    
    setSessionItems((prev) => [...prev, ...items]);
    setIsContinuationPhase(false);
    // Move to next item (which is the first new one)
    setCurrentIndex((prev) => prev + 1);
  }, []);

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

    // V2: Track accuracy by direction
    let recCorrect = 0,
      recTotal = 0,
      prodCorrect = 0,
      prodTotal = 0;

    answers.forEach((answer, idx) => {
      if (idx < sessionItems.length) {
        const domain = sessionItems[idx].wordProgress.domain;
        domainAccuracy[domain].total++;
        if (answer.wasCorrect) domainAccuracy[domain].correct++;

        // Track direction accuracy
        const direction = answer.trackDirection || sessionItems[idx].trackDirection;
        if (direction === "recognition") {
          recTotal++;
          if (answer.wasCorrect) recCorrect++;
        } else if (direction === "production") {
          prodTotal++;
          if (answer.wasCorrect) prodCorrect++;
        }
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
    const exerciseBreakdown: Record<string, number> = {};
    sessionItems.forEach((item) => {
      exerciseBreakdown[item.exerciseType] =
        (exerciseBreakdown[item.exerciseType] || 0) + 1;
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

    // Leech words reviewed
    const leechWordsReviewed = sessionItems.filter(
      (item) => item.wordProgress.isLeech
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
      // V2 additions
      recognitionAccuracy: recTotal > 0 ? recCorrect / recTotal : 0,
      productionAccuracy: prodTotal > 0 ? prodCorrect / prodTotal : 0,
      fatigueData: fatigueTrackerRef.current.getSessionFatigueData(),
      leechWordsReviewed,
      // V3.1 additions — pipeline metadata
      localDate: getTodayString(),
      localStartHour: getHourOfDay(),
      dayOfWeek: getDayOfWeek(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }, [answers, sessionItems]);

  const resetSession = useCallback(() => {
    setSessionItems([]);
    setCurrentIndex(0);
    setIsActive(false);
    setIsComplete(false);
    setAnswers([]);
    setIsContinuationPhase(false);
    setFatigueLevel("green");
    setFatigueScore(0);
    sessionStartTime.current = null;
  }, []);

  const correctCount = answers.filter((a) => a.wasCorrect).length;

  // V2: Track accuracy by direction
  const recAnswers = answers.filter((a, i) => {
    const dir = a.trackDirection || sessionItems[i]?.trackDirection;
    return dir === "recognition";
  });
  const prodAnswers = answers.filter((a, i) => {
    const dir = a.trackDirection || sessionItems[i]?.trackDirection;
    return dir === "production";
  });

  const recognitionAccuracy =
    recAnswers.length > 0
      ? recAnswers.filter((a) => a.wasCorrect).length / recAnswers.length
      : 0;
  const productionAccuracy =
    prodAnswers.length > 0
      ? prodAnswers.filter((a) => a.wasCorrect).length / prodAnswers.length
      : 0;

  return {
    sessionItems,
    currentIndex,
    currentItem,
    isActive,
    isComplete,
    answers,
    sessionStartTime: sessionStartTime.current,
    isContinuationPhase,
    startSession,
    submitAnswer,
    nextItem,
    addItems,
    endSession,
    resetSession,
    progress:
      sessionItems.length > 0 ? (currentIndex / sessionItems.length) * 100 : 0,
    totalItems: sessionItems.length,
    correctCount,
    accuracy: answers.length > 0 ? correctCount / answers.length : 0,
    elapsedMs: sessionStartTime.current ? Date.now() - sessionStartTime.current : 0,
    // Fatigue
    fatigueTracker: fatigueTrackerRef.current,
    fatigueLevel,
    fatigueScore,
    fatigueData: fatigueTrackerRef.current.getSessionFatigueData(),

    recognitionAccuracy,
    productionAccuracy,
    seenWordIds: seenWordIds.current,
  };
}
