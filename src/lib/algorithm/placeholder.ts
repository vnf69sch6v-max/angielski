import { WordProgress, ExerciseType, SessionItem } from "../types";

/**
 * PLACEHOLDER ALGORITHM
 * All functions here will be replaced in Phase 2 with real FSRS implementation.
 * They currently return mock/simplified data to allow the UI to function.
 */

// TODO: Phase 2 — replace with FSRS (ts-fsrs package)
export function getSessionWords(allWords: WordProgress[]): SessionItem[] {
  // Shuffle and take up to 10 words
  const shuffled = [...allWords].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(10, shuffled.length));

  return selected.map((wp) => ({
    wordProgress: wp,
    exerciseType: getExerciseType(wp),
  }));
}

// TODO: Phase 2 — replace with FSRS scoring pipeline
export function scoreAnswer(
  _exerciseType: ExerciseType,
  _rawResult: number,
  _responseTimeMs: number
): number {
  // Always return "Good" (3) for now
  return 3;
}

// TODO: Phase 2 — replace with FSRS next review calculation
export function getNextReviewDate(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

// TODO: Phase 2 — replace with exercise escalator
export function getExerciseType(wordProgress: WordProgress): ExerciseType {
  // Simple logic: new/learning → flashcard, review → mix
  if (wordProgress.state === "new" || wordProgress.state === "learning") {
    return "flashcard";
  }

  // For review words, randomly pick based on exercise level
  const types: ExerciseType[] = ["flashcard", "matching", "quiz", "translation"];
  const level = Math.min(wordProgress.exerciseLevel, 4);
  
  // Randomly pick between flashcard and current level
  if (Math.random() < 0.5) {
    return "flashcard";
  }
  return types[level - 1];
}

// TODO: Phase 2 — replace with FSRS review logic
export function processAnswer(
  wordProgress: WordProgress,
  wasCorrect: boolean,
  _rating: number
): Partial<WordProgress> {
  return {
    totalAttempts: wordProgress.totalAttempts + 1,
    correctAttempts: wordProgress.correctAttempts + (wasCorrect ? 1 : 0),
    accuracy:
      (wordProgress.correctAttempts + (wasCorrect ? 1 : 0)) /
      (wordProgress.totalAttempts + 1),
    consecutiveCorrect: wasCorrect ? wordProgress.consecutiveCorrect + 1 : 0,
    timesWrongTotal: wordProgress.timesWrongTotal + (wasCorrect ? 0 : 1),
    state: wasCorrect && wordProgress.state === "new" ? "learning" : wordProgress.state,
  };
}
