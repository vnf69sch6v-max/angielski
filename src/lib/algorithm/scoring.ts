/**
 * Scoring Pipeline — converts raw exercise answers to FSRS ratings
 * Based on FluentFlow Algorithm Spec §6 + V2 Extension
 */
import { ExerciseType } from "@/lib/types";

// ─── Exercise weights (§5.1 + V2 §3.1) ──────────────

const EXERCISE_WEIGHTS: Record<ExerciseType, number> = {
  flashcard: 1.0,
  reverse_typing: 1.1,
  matching: 0.9,
  listening: 1.0,
  quiz: 1.0,
  translation: 1.2,
  context_production: 1.3,
};

// ─── Levenshtein distance ────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      const cost = bLower.charAt(i - 1) === aLower.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[bLower.length][aLower.length];
}

// ─── Score reverse typing by Levenshtein ─────────────

export function scoreReverseTyping(
  userAnswer: string,
  correctAnswer: string,
  acceptedVariants: string[] = []
): { rating: 1 | 2 | 3 | 4; distance: number } {
  const allCorrect = [correctAnswer, ...acceptedVariants];

  // Find minimum distance across all accepted variants
  let minDist = Infinity;
  for (const correct of allCorrect) {
    const dist = levenshteinDistance(userAnswer.trim(), correct.trim());
    if (dist < minDist) minDist = dist;
  }

  let rating: 1 | 2 | 3 | 4;
  if (minDist === 0) rating = 4;
  else if (minDist <= 2) rating = 3;
  else if (minDist <= 4) rating = 2;
  else rating = 1;

  return { rating, distance: minDist };
}

// ─── Score listening answer ──────────────────────────

export function scoreListening(
  userAnswer: string,
  correctAnswer: string
): { rating: 1 | 2 | 3 | 4; distance: number } {
  // Same logic as reverse typing
  return scoreReverseTyping(userAnswer, correctAnswer);
}

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

    case "reverse_typing":
    case "listening":
      // rawResult is already a rating 1-4 from Levenshtein scoring
      return Math.max(1, Math.min(4, rawResult));

    case "matching":
      // rawResult is correctPairs (0-5)
      if (rawResult <= 1) return 1;
      if (rawResult <= 3) return 2;
      if (rawResult === 4) return 3;
      return 4; // 5 correct

    case "quiz":
      // rawResult: 0 = wrong, 1 = correct
      return rawResult >= 1 ? 3 : 1;

    case "translation":
      // rawResult is AI score (0-100)
      if (rawResult < 40) return 1;
      if (rawResult < 65) return 2;
      if (rawResult < 90) return 3;
      return 4;

    case "context_production":
      // rawResult is AI score (0-100), same scale as translation
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
  // §6.3: Quiz/translation/context get double thresholds
  const isLongExercise =
    exerciseType === "quiz" ||
    exerciseType === "translation" ||
    exerciseType === "context_production";
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
  // Reguła 4: Never upgrade based on speed (§6.3 strict compliance)

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
    case "reverse_typing":
    case "listening":
      return rawResult >= 3; // rating 3+ = correct
    case "matching":
      return rawResult >= 4;
    case "quiz":
      return rawResult >= 1;
    case "translation":
    case "context_production":
      return rawResult >= 65;
    default:
      return false;
  }
}
