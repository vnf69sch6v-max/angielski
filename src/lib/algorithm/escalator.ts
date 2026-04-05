/**
 * Exercise Escalator — 7-level exercise ladder with dual-track direction selection
 * Based on FluentFlow V2 Extension §3
 */
import {
  WordProgress,
  ExerciseType,
  ExerciseLevel,
  TrackDirection,
  EXERCISE_TYPE_MAP,
} from "@/lib/types";

// ─── Promotion thresholds per level (V2 §3.2) ───────

interface PromotionRule {
  accuracyThreshold: number;
  minReviews: number;
}

const PROMOTION_RULES: Record<ExerciseLevel, PromotionRule> = {
  1: { accuracyThreshold: 0.80, minReviews: 3 },
  2: { accuracyThreshold: 0.80, minReviews: 3 },
  3: { accuracyThreshold: 0.85, minReviews: 3 },
  4: { accuracyThreshold: 0.85, minReviews: 3 },
  5: { accuracyThreshold: 0.85, minReviews: 5 },
  6: { accuracyThreshold: 0.85, minReviews: 5 },
  7: { accuracyThreshold: 1.0, minReviews: Infinity }, // top level
};

// ─── Determine track direction for a word (V2 §1.4) ──

export function getTrackDirection(wp: WordProgress): TrackDirection {
  if (!wp.tracks) return "recognition"; // legacy fallback

  const rec = wp.tracks.recognition;
  const prod = wp.tracks.production;

  // Rule 3: New words — first 2 exposures always recognition
  if (rec.state === "new" && prod.state === "new") {
    return rec.totalAttempts < 2 ? "recognition" : "production";
  }

  // Rule 4: Learning phase — early steps = recognition, later = production
  if (rec.state === "learning") {
    return rec.learningStep < 2 ? "recognition" : "production";
  }

  // Rule 6: Special — high recognition, very low production → skip recognition
  if (rec.accuracy > 0.90 && prod.accuracy < 0.50 && prod.state !== "new") {
    return "production";
  }

  // Rule 5: Review phase — check overdue first
  const now = Date.now();
  const prodOverdue = prod.nextReview && prod.nextReview.toMillis() <= now;
  const recOverdue = rec.nextReview && rec.nextReview.toMillis() <= now;

  if (prodOverdue && recOverdue) return "production"; // both overdue → production first
  if (prodOverdue) return "production";
  if (recOverdue) return "recognition";

  // Rule 2: Calculate gap and randomize
  const gap = rec.accuracy - prod.accuracy;
  let productionProbability: number;

  if (gap > 0.20) productionProbability = 0.80;
  else if (gap > 0.10) productionProbability = 0.65;
  else productionProbability = 0.50;

  return Math.random() < productionProbability ? "production" : "recognition";
}

// ─── Get exercise type for a word (V2 §3.1) ──────────

export function getExerciseType(wp: WordProgress): ExerciseType {
  // Learning/relearning always flashcard
  if (wp.state === "learning" || wp.state === "relearning" || wp.state === "new") {
    return "flashcard";
  }

  // Leech words always flashcard
  if (wp.isLeech) {
    return "flashcard";
  }

  return EXERCISE_TYPE_MAP[wp.exerciseLevel] || "flashcard";
}

// ─── Get exercise type considering fatigue ────────────

export function getExerciseTypeWithFatigue(
  wp: WordProgress,
  fatigueDowngrade: boolean,
  forceLightMode: boolean
): ExerciseType {
  if (forceLightMode) return "flashcard";

  const baseType = getExerciseType(wp);

  if (fatigueDowngrade) {
    // Cap at matching during moderate fatigue
    const FATIGUE_MAX_LEVEL: ExerciseLevel = 3;
    if (wp.exerciseLevel > FATIGUE_MAX_LEVEL) {
      return EXERCISE_TYPE_MAP[FATIGUE_MAX_LEVEL];
    }
  }

  return baseType;
}

// ─── Update exercise level after answer (V2 §3.2) ────

export function updateExerciseLevel(
  wp: WordProgress,
  wasCorrect: boolean
): WordProgress {
  const updated = { ...wp };

  // Don't escalate during learning or leech
  if (
    wp.state === "learning" ||
    wp.state === "relearning" ||
    wp.state === "new" ||
    wp.isLeech
  ) {
    return updated;
  }

  // Get effective accuracy for promotion/demotion check
  const effectiveAccuracy = getEffectiveAccuracy(wp);

  if (wasCorrect) {
    // Check special skip: Level 1 → Level 3
    if (
      wp.exerciseLevel === 1 &&
      wp.tracks &&
      wp.tracks.recognition.accuracy > 0.95 &&
      wp.tracks.production.accuracy > 0.80
    ) {
      updated.exerciseLevel = 3 as ExerciseLevel;
      updated.consecutiveCorrect = 0;
      return updated;
    }

    // Normal promotion check
    const rule = PROMOTION_RULES[wp.exerciseLevel];

    // FIX: Use the actual consecutiveCorrect value (already updated by reviewWord)
    // For level 1, use a relaxed threshold — words that just graduated from
    // learning already proved they know the word during learning steps
    const effectiveMinReviews = wp.exerciseLevel === 1 ? Math.min(rule.minReviews, 2) : rule.minReviews;
    const effectiveAccThreshold = wp.exerciseLevel === 1 ? 0.70 : rule.accuracyThreshold;

    if (
      effectiveAccuracy >= effectiveAccThreshold &&
      wp.consecutiveCorrect >= effectiveMinReviews &&
      wp.exerciseLevel < 7
    ) {
      updated.exerciseLevel = (wp.exerciseLevel + 1) as ExerciseLevel;
      updated.consecutiveCorrect = 0;
    }
  } else {
    // Demotion logic
    if (effectiveAccuracy < 0.40 && wp.exerciseLevel > 2) {
      // Drastic drop → demote 2 levels
      updated.exerciseLevel = Math.max(1, wp.exerciseLevel - 2) as ExerciseLevel;
      updated.consecutiveCorrect = 0;
    } else if (effectiveAccuracy < 0.60 && wp.exerciseLevel > 1) {
      // Moderate drop → demote 1 level
      updated.exerciseLevel = (wp.exerciseLevel - 1) as ExerciseLevel;
      updated.consecutiveCorrect = 0;
    }
  }

  // V3 FIX 3: Escalation logging
  if (typeof window !== 'undefined') {
    const decision = updated.exerciseLevel !== wp.exerciseLevel
      ? (updated.exerciseLevel > wp.exerciseLevel ? `PROMOTE to level ${updated.exerciseLevel}` : `DEMOTE to level ${updated.exerciseLevel}`)
      : 'NO CHANGE';
    console.log(
      `[ESCALATOR] Word: "${wp.word}"\n` +
      `  exerciseLevel: ${wp.exerciseLevel} → ${updated.exerciseLevel}\n` +
      `  consecutiveCorrect: ${wp.consecutiveCorrect} (threshold: ${PROMOTION_RULES[wp.exerciseLevel].minReviews})\n` +
      `  effectiveAccuracy: ${effectiveAccuracy.toFixed(2)} (threshold: ${PROMOTION_RULES[wp.exerciseLevel].accuracyThreshold})\n` +
      `  wasCorrect: ${wasCorrect}\n` +
      `  DECISION: ${decision}`
    );
  }

  return updated;
}

// ─── Get effective accuracy for promotion checks ─────

function getEffectiveAccuracy(wp: WordProgress): number {
  if (!wp.tracks) return wp.accuracy;

  const level = wp.exerciseLevel;

  // Level 1 (flashcard, recognition): check recognition
  if (level === 1) return wp.tracks.recognition.accuracy;

  // Level 2 (reverse, production): check production
  if (level === 2) return wp.tracks.production.accuracy;

  // Levels 3-7: check WORSE of two tracks
  return Math.min(wp.tracks.recognition.accuracy, wp.tracks.production.accuracy);
}

// ─── Get easier exercise type for retry (§4.5) ──────

export function getEasierExerciseType(currentType: ExerciseType): ExerciseType {
  switch (currentType) {
    case "context_production": return "translation";
    case "translation": return "quiz";
    case "quiz": return "matching";
    case "listening": return "matching";
    case "matching": return "reverse_typing";
    case "reverse_typing": return "flashcard";
    case "flashcard": return "flashcard";
  }
}
