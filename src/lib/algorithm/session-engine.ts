/**
 * Session Engine — builds learning sessions with smart word selection
 * Based on FluentFlow Algorithm Spec §4
 */
import { WordProgress, SessionItem, UserStats, Domain, ExerciseType } from "@/lib/types";
import { getDueWords, initializeWord } from "./fsrs-engine";
import { getExerciseType } from "./escalator";
import { getDomainWeights, pickWordsForDomain, getWeakestDomain } from "./domain-balancer";

const SESSION_SIZE = 25;       // §4.1: ~25 interactions
const MAX_REVIEWS_PER_SESSION = 30; // §9.1: max 30 reviews even if more overdue
const MAX_LEARNING_TOTAL = 20; // §4.2: max 20 words in learning state

// ─── Build a complete session (§4.1-4.3) ─────────────

export function buildSession(
  allWords: WordProgress[],
  newWordPool: WordProgress[],
  stats: UserStats | null,
  userDomainWeights?: Record<Domain, number>
): SessionItem[] {
  const session: SessionItem[] = [];
  const domainWeights = getDomainWeights(stats, userDomainWeights);

  // ── Phase 0: Count states ──────────────────────────
  const dueReviewWords = getDueWords(
    allWords.filter((w) => w.state === "review" || w.state === "relearning")
  );
  const learningWords = allWords.filter(
    (w) => w.state === "learning" && isDue(w)
  );
  const currentLearningCount = allWords.filter(
    (w) => w.state === "learning"
  ).length;

  // ── Phase 1: New words (§4.2-4.3) ─────────────────
  const newWordsToday = calculateNewWordsCount(
    dueReviewWords.length,
    currentLearningCount
  );

  // Pick new words prioritizing weakest domain (§4.4)
  const weakestDomain = getWeakestDomain(stats);
  const sortedPool = sortNewWordPool(newWordPool, weakestDomain);
  const newWords = sortedPool.slice(0, newWordsToday);

  for (const word of newWords) {
    const initialized = initializeWord(word);
    session.push({
      wordProgress: initialized,
      exerciseType: "flashcard", // §3.3: learning always flashcard
    });
  }

  // ── Phase 2: Learning words due (§4.3) ────────────
  for (const word of learningWords) {
    session.push({
      wordProgress: word,
      exerciseType: "flashcard", // §5.1: learning = always flashcard
    });
  }

  // ── Phase 3: Review words (§4.3) ──────────────────
  const reviewCount = Math.min(
    MAX_REVIEWS_PER_SESSION,
    SESSION_SIZE - session.length,
    dueReviewWords.length
  );

  const pickedReviews = pickWordsForDomain(
    dueReviewWords,
    domainWeights,
    reviewCount
  );

  for (const word of pickedReviews) {
    const exerciseType = getExerciseType(word);
    session.push({
      wordProgress: word,
      exerciseType,
    });
  }

  // ── Phase 4: Monthly mastered spot-check (§3.6) ───
  const masteredWords = allWords.filter((w) => w.state === "mastered");
  if (masteredWords.length > 0 && session.length < SESSION_SIZE) {
    const spotCheckCount = Math.min(5, masteredWords.length, SESSION_SIZE - session.length);
    const shuffled = [...masteredWords].sort(() => Math.random() - 0.5);
    for (let i = 0; i < spotCheckCount; i++) {
      session.push({
        wordProgress: shuffled[i],
        exerciseType: "flashcard",
      });
    }
  }

  return session.slice(0, SESSION_SIZE);
}

// ─── Dynamic new words count (§4.2) ─────────────────

function calculateNewWordsCount(
  overdueCount: number,
  learningInProgress: number
): number {
  // §4.2: Don't add new if too many in learning
  if (learningInProgress >= MAX_LEARNING_TOTAL) return 0;

  let count: number;

  if (overdueCount > 20) {
    count = 3; // Dużo powtórek → minimum nowych
  } else if (overdueCount > 10) {
    count = 5; // Standard
  } else if (overdueCount <= 10 && overdueCount > 5) {
    count = 7; // Mało powtórek → więcej nowych
  } else if (overdueCount <= 5 && learningInProgress <= 3) {
    count = 10; // Agresywne tempo
  } else {
    count = 7;
  }

  // §4.2: Clamp MIN 3, MAX 10
  return Math.max(3, Math.min(10, count));
}

// ─── Sort new word pool (§3.2, §4.4) ────────────────

function sortNewWordPool(
  pool: WordProgress[],
  weakestDomain: Domain
): WordProgress[] {
  const levelOrder: Record<string, number> = { B1: 0, B2: 1, C1: 2 };

  return [...pool].sort((a, b) => {
    // Prioritize weakest domain
    const domA = a.domain === weakestDomain ? 0 : 1;
    const domB = b.domain === weakestDomain ? 0 : 1;
    if (domA !== domB) return domA - domB;

    // Then sort by level: B1 → B2 → C1
    const levelA = levelOrder[a.level] ?? 1;
    const levelB = levelOrder[b.level] ?? 1;
    return levelA - levelB;
  });
}

// ─── Handle retry logic (§4.5) ──────────────────────

export function getRetryItem(
  originalItem: SessionItem,
  attemptCount: number
): SessionItem | null {
  // §4.5: Max 2 attempts per word per session
  if (attemptCount >= 2) return null;

  // Return in easier exercise type
  const easierType = getEasierExercise(originalItem.exerciseType);
  return {
    wordProgress: originalItem.wordProgress,
    exerciseType: easierType,
  };
}

function getEasierExercise(current: ExerciseType): ExerciseType {
  switch (current) {
    case "translation": return "quiz";
    case "quiz": return "matching";
    case "matching": return "flashcard";
    case "flashcard": return "flashcard";
  }
}

// ─── Helper ─────────────────────────────────────────

function isDue(wp: WordProgress): boolean {
  if (!wp.nextReview) return true;
  return wp.nextReview.toMillis() <= Date.now();
}
