/**
 * Scoring Pipeline — converts raw exercise answers to FSRS ratings
 * Based on FluentFlow Algorithm Spec §6
 */
import { ExerciseType } from "@/lib/types";

// ─── Exercise weights (§5.1) ─────────────────────────

const EXERCISE_WEIGHTS: Record<ExerciseType, number> = {
  flashcard: 0.8,
  matching: 0.9,
  quiz: 1.0,
  translation: 1.2,
};

// ─── Main scoring function (§6.1-6.4) ────────────────

export function scoreAnswer(
  exerciseType: ExerciseType,
  rawResult: number,
  responseTimeMs: number
): 1 | 2 | 3 | 4 {
  // Step 1: Raw score per exercise type (§6.2)
  let rating = getRawScore(exerciseType, rawResult);

  // Step 2: Time validation (§6.3)
  rating = validateByTime(exerciseType, rating, responseTimeMs);

  // Step 3: Exercise weight (§6.4)
  const weighted = Math.round(rating * EXERCISE_WEIGHTS[exerciseType]);

  // Clamp to 1-4
  return Math.max(1, Math.min(4, weighted)) as 1 | 2 | 3 | 4;
}

// ─── Step 1: Raw Score (§6.2) ────────────────────────

function getRawScore(exerciseType: ExerciseType, rawResult: number): number {
  switch (exerciseType) {
    case "flashcard":
      // rawResult is user's button click (1-4)
      return Math.max(1, Math.min(4, rawResult));

    case "matching":
      // rawResult is correctPairs (0-5)
      if (rawResult <= 1) return 1;
      if (rawResult <= 3) return 2;
      if (rawResult === 4) return 3;
      return 4; // 5 correct

    case "quiz":
      // rawResult: 0 = wrong, 1 = correct
      // Fast correct = Easy, normal correct = Good, wrong = Again
      return rawResult >= 1 ? 3 : 1;

    case "translation":
      // rawResult is AI score (0-100)
      if (rawResult < 40) return 1;
      if (rawResult < 65) return 2;
      if (rawResult < 90) return 3;
      return 4;

    default:
      return 3;
  }
}

// ─── Step 2: Time Validation (§6.3) ─────────────────

function validateByTime(
  exerciseType: ExerciseType,
  rating: number,
  responseTimeMs: number
): number {
  // §6.3: Quiz/translation get double thresholds
  const isLongExercise = exerciseType === "quiz" || exerciseType === "translation";
  const easyThreshold = isLongExercise ? 30000 : 15000;
  const goodThreshold = isLongExercise ? 60000 : 30000;

  // Reguła 1: Easy but too slow → downgrade to Good
  if (rating === 4 && responseTimeMs > easyThreshold) {
    rating = 3;
  }

  // Reguła 2: Good but too slow → downgrade to Hard
  if (rating === 3 && responseTimeMs > goodThreshold) {
    rating = 2;
  }

  // Reguła 3: Suspiciously fast on quiz/translation → keep but flag
  // (we don't modify rating, just noted for analytics)

  // Reguła 4: Never upgrade based on speed
  // (Quiz fast correct → Easy is handled in getRawScore)
  if (exerciseType === "quiz" && rating === 3 && responseTimeMs < 5000) {
    rating = 4; // Quick correct on quiz = Easy
  }

  return rating;
}

// ─── Utility: Check if answer was correct ────────────

export function wasAnswerCorrect(
  exerciseType: ExerciseType,
  rawResult: number
): boolean {
  switch (exerciseType) {
    case "flashcard":
      return rawResult >= 3;
    case "matching":
      return rawResult >= 4;
    case "quiz":
      return rawResult >= 1;
    case "translation":
      return rawResult >= 65;
    default:
      return false;
  }
}
