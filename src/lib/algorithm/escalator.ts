/**
 * Exercise Escalator — selects exercise type based on mastery level
 * Based on FluentFlow Algorithm Spec §5
 */
import { WordProgress, ExerciseType, ExerciseLevel, EXERCISE_TYPE_MAP } from "@/lib/types";

// ─── Promotion thresholds (§5.1) ─────────────────────

const PROMOTION_RULES: Record<ExerciseLevel, { accuracyThreshold: number; correctStreak: number }> = {
  1: { accuracyThreshold: 0.80, correctStreak: 3 },  // flashcard → matching
  2: { accuracyThreshold: 0.85, correctStreak: 3 },  // matching → quiz
  3: { accuracyThreshold: 0.85, correctStreak: 5 },  // quiz → translation
  4: { accuracyThreshold: 1.0, correctStreak: Infinity }, // translation stays
};

const DEMOTION_ACCURACY = 0.70; // §5.1: accuracy < 70% → demote one level

// ─── Get exercise type for a word (§5.1) ─────────────

export function getExerciseType(wp: WordProgress): ExerciseType {
  // Learning/relearning always flashcard (§3.3, §5.1)
  if (wp.state === "learning" || wp.state === "relearning" || wp.state === "new") {
    return "flashcard";
  }

  return EXERCISE_TYPE_MAP[wp.exerciseLevel];
}

// ─── Update after answer — check promotion/demotion ──

export function updateExerciseLevel(
  wp: WordProgress,
  wasCorrect: boolean
): WordProgress {
  const updated = { ...wp };

  // Don't escalate during learning
  if (wp.state === "learning" || wp.state === "relearning" || wp.state === "new") {
    return updated;
  }

  if (wasCorrect) {
    // Check promotion
    const rule = PROMOTION_RULES[wp.exerciseLevel];
    if (
      wp.accuracy >= rule.accuracyThreshold &&
      wp.consecutiveCorrect >= rule.correctStreak &&
      wp.exerciseLevel < 4
    ) {
      updated.exerciseLevel = (wp.exerciseLevel + 1) as ExerciseLevel;
      updated.consecutiveCorrect = 0; // Reset streak for new level
    }
  } else {
    // §5.1 DEGRADACJA: accuracy < 70% at level > 1 → demote
    if (wp.accuracy < DEMOTION_ACCURACY && wp.exerciseLevel > 1) {
      updated.exerciseLevel = (wp.exerciseLevel - 1) as ExerciseLevel;
      updated.consecutiveCorrect = 0;
    }
  }

  return updated;
}

// ─── Get easier exercise type for retry (§4.5) ──────

export function getEasierExerciseType(currentType: ExerciseType): ExerciseType {
  switch (currentType) {
    case "translation": return "quiz";
    case "quiz": return "matching";
    case "matching": return "flashcard";
    case "flashcard": return "flashcard";
  }
}
