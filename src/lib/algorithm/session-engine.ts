/**
 * Session Engine — builds learning sessions with smart word selection
 * V2: Unlimited sessions with continuation phases + dual-track + leech support
 * Based on FluentFlow Algorithm Spec §4 + V2 Extension §4
 */
import { WordProgress, SessionItem, UserStats, Domain } from "@/lib/types";
import { initializeWord } from "./fsrs-engine";
import { getExerciseType, getExerciseTypeWithFatigue, getTrackDirection } from "./escalator";
import { getDomainWeights, pickWordsForDomain, getWeakestDomain } from "./domain-balancer";
import { getLeechWordsForSession } from "./leech";
import { migrateWordToV2, needsMigration } from "./migration";
import { FatigueTracker } from "./fatigue";

const MAX_REVIEWS_PER_SESSION = 30;
const MAX_LEARNING_TOTAL = 20;
const DAILY_NEW_WORD_CAP = 50;
const CONTINUATION_BATCH_SIZE = 10;

// ─── Build initial session (Phases 0-3 + leech) ─────

export function buildSession(
  allWords: WordProgress[],
  newWordPool: WordProgress[],
  stats: UserStats | null,
  userDomainWeights?: Record<Domain, number>
): SessionItem[] {
  const session: SessionItem[] = [];
  const domainWeights = getDomainWeights(stats, userDomainWeights);

  // Migrate all words to V2 if needed
  const migrated = allWords.map((w) => (needsMigration(w) ? migrateWordToV2(w) : w));

  // ── Phase 0: Leech words (max 5, at start) ────────
  const leechWords = getLeechWordsForSession(migrated);
  for (const word of leechWords) {
    const direction = getTrackDirection(word);
    session.push({
      wordProgress: word,
      exerciseType: "flashcard", // Leeches always flashcard
      trackDirection: direction,
    });
  }

  // ── Phase 0.5: Count states ────────────────────────
  const dueReviewWords = getDueWords(
    migrated.filter((w) => w.state === "review" || w.state === "relearning")
  );
  const learningWords = migrated.filter(
    (w) => w.state === "learning" && isDue(w)
  );
  const currentLearningCount = migrated.filter(
    (w) => w.state === "learning"
  ).length;

  // ── Phase 1: New words (§4.2-4.3) ─────────────────
  const newWordsToday = calculateNewWordsCount(
    dueReviewWords.length,
    currentLearningCount
  );

  const weakestDomain = getWeakestDomain(stats);
  const sortedPool = sortNewWordPool(newWordPool, weakestDomain);
  const newWords = sortedPool.slice(0, newWordsToday);

  for (const word of newWords) {
    const initialized = initializeWord(
      needsMigration(word) ? migrateWordToV2(word) : word
    );
    session.push({
      wordProgress: initialized,
      exerciseType: "flashcard",
      trackDirection: "recognition", // New words always start recognition
    });
  }

  // ── Phase 2: Learning words due ────────────────────
  for (const word of learningWords) {
    const direction = getTrackDirection(word);
    session.push({
      wordProgress: word,
      exerciseType: "flashcard",
      trackDirection: direction,
    });
  }

  // ── Phase 3: Review words ──────────────────────────
  const reviewCount = Math.min(MAX_REVIEWS_PER_SESSION, dueReviewWords.length);

  const pickedReviews = pickWordsForDomain(
    dueReviewWords,
    domainWeights,
    reviewCount
  );

  for (const word of pickedReviews) {
    const direction = getTrackDirection(word);
    const exerciseType = getExerciseType(word);
    session.push({
      wordProgress: word,
      exerciseType,
      trackDirection: direction,
    });
  }

  // ── Phase 4: Monthly mastered spot-check (§3.6) ───
  const masteredWords = migrated.filter((w) => w.state === "mastered");
  if (masteredWords.length > 0) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentlyChecked = masteredWords.some(
      (w) => w.lastReview && w.lastReview.toMillis() > thirtyDaysAgo
    );

    if (!recentlyChecked) {
      const spotCheckCount = Math.min(5, masteredWords.length);
      const shuffled = [...masteredWords].sort(() => Math.random() - 0.5);
      for (let i = 0; i < spotCheckCount; i++) {
        const direction = getTrackDirection(shuffled[i]);
        session.push({
          wordProgress: shuffled[i],
          exerciseType: "flashcard",
          trackDirection: direction,
        });
      }
    }
  }

  return session;
}

// ─── V2: Continuation phase — next batch of items ────

export type ContinuationPriority = "production_gap" | "new_words" | "drill_weak" | "preview";

export function getNextContinuationBatch(
  allWords: WordProgress[],
  fatigueTracker: FatigueTracker,
  priority: ContinuationPriority,
  newWordsToday: number,
  newWordPool: WordProgress[],
  dailyCap: number = DAILY_NEW_WORD_CAP,
  seenWordIds: Set<string> = new Set()
): SessionItem[] {
  const batch: SessionItem[] = [];

  // Migrate if needed
  const migrated = allWords.map((w) => (needsMigration(w) ? migrateWordToV2(w) : w));
  const fatigueDown = fatigueTracker.shouldDowngradeExercises();
  const forceLight = fatigueTracker.shouldForceLightMode();

  switch (priority) {
    case "production_gap": {
      // P1: Words with highest recognition-production gap
      const wordsWithGap = migrated
        .filter(
          (w) =>
            w.tracks &&
            w.state !== "new" &&
            !seenWordIds.has(w.wordId) &&
            w.tracks.recognition.accuracy - w.tracks.production.accuracy > 0.10
        )
        .sort((a, b) => {
          const gapA = a.tracks!.recognition.accuracy - a.tracks!.production.accuracy;
          const gapB = b.tracks!.recognition.accuracy - b.tracks!.production.accuracy;
          return gapB - gapA;
        })
        .slice(0, CONTINUATION_BATCH_SIZE);

      for (const word of wordsWithGap) {
        const exerciseType = getExerciseTypeWithFatigue(word, fatigueDown, forceLight);
        batch.push({
          wordProgress: word,
          exerciseType,
          trackDirection: "production",
        });
      }
      break;
    }

    case "new_words": {
      // P2: New words, gated by fatigue
      const gate = fatigueTracker.getNewWordGate(fatigueTracker.lastFiveCorrect);
      if (gate === 0 || newWordsToday >= dailyCap) break;

      const filteredPool = newWordPool.filter(w => !seenWordIds.has(w.wordId));
      const count = Math.min(gate, dailyCap - newWordsToday, filteredPool.length);
      for (let i = 0; i < count; i++) {
        const word = filteredPool[i];
        if (!word) break;
        const initialized = initializeWord(
          needsMigration(word) ? migrateWordToV2(word) : word
        );
        batch.push({
          wordProgress: initialized,
          exerciseType: "flashcard",
          trackDirection: "recognition",
        });
      }
      break;
    }

    case "drill_weak": {
      // P3: Weakest words by accuracy
      const weakest = migrated
        .filter((w) => w.state !== "new" && w.totalAttempts > 0 && !seenWordIds.has(w.wordId))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, CONTINUATION_BATCH_SIZE);

      for (const word of weakest) {
        const direction = getTrackDirection(word);
        const exerciseType = getExerciseTypeWithFatigue(word, fatigueDown, forceLight);
        batch.push({
          wordProgress: word,
          exerciseType,
          trackDirection: direction,
        });
      }
      break;
    }

    case "preview": {
      // P4: Words due in next 2 days
      const twoDaysFromNow = Date.now() + 2 * 24 * 60 * 60 * 1000;
      const previewWords = migrated
        .filter(
          (w) =>
            w.state === "review" &&
            w.nextReview &&
            !seenWordIds.has(w.wordId) &&
            w.nextReview.toMillis() > Date.now() &&
            w.nextReview.toMillis() <= twoDaysFromNow
        )
        .sort((a, b) => a.nextReview.toMillis() - b.nextReview.toMillis())
        .slice(0, CONTINUATION_BATCH_SIZE);

      for (const word of previewWords) {
        const direction = getTrackDirection(word);
        const exerciseType = getExerciseTypeWithFatigue(word, fatigueDown, forceLight);
        batch.push({
          wordProgress: word,
          exerciseType,
          trackDirection: direction,
        });
      }
      break;
    }
  }

  return batch;
}

// ─── Cycle through continuation priorities ───────────

const PRIORITY_CYCLE: ContinuationPriority[] = [
  "production_gap",
  "new_words",
  "drill_weak",
  "preview",
];

export function getNextPriority(currentIndex: number): {
  priority: ContinuationPriority;
  nextIndex: number;
} {
  const idx = currentIndex % PRIORITY_CYCLE.length;
  return {
    priority: PRIORITY_CYCLE[idx],
    nextIndex: currentIndex + 1,
  };
}

// ─── Dynamic new words count (§4.2) ─────────────────

function calculateNewWordsCount(
  overdueCount: number,
  learningInProgress: number
): number {
  if (learningInProgress >= MAX_LEARNING_TOTAL) return 0;

  let count: number;

  if (overdueCount > 20) {
    count = 3;
  } else if (overdueCount > 10) {
    count = 5;
  } else if (overdueCount <= 10 && overdueCount > 5) {
    count = 7;
  } else if (overdueCount <= 5 && learningInProgress <= 3) {
    count = 10;
  } else {
    count = 7;
  }

  return Math.max(3, Math.min(10, count));
}

// ─── Sort new word pool (§3.2, §4.3, §4.4) ──────────

function sortNewWordPool(
  pool: WordProgress[],
  weakestDomain: Domain
): WordProgress[] {
  const levelOrder: Record<string, number> = { B1: 0, B2: 1, C1: 2 };

  const sorted = [...pool].sort((a, b) => {
    const domA = a.domain === weakestDomain ? 0 : 1;
    const domB = b.domain === weakestDomain ? 0 : 1;
    if (domA !== domB) return domA - domB;

    const levelA = levelOrder[a.level] ?? 1;
    const levelB = levelOrder[b.level] ?? 1;
    return levelA - levelB;
  });

  // Group synonym pairs together
  const result: WordProgress[] = [];
  const used = new Set<string>();

  for (const word of sorted) {
    if (used.has(word.wordId)) continue;
    used.add(word.wordId);
    result.push(word);

    if (word.synonymPair) {
      for (const partner of sorted) {
        if (
          !used.has(partner.wordId) &&
          partner.synonymPair === word.synonymPair
        ) {
          used.add(partner.wordId);
          result.push(partner);
        }
      }
    }
  }

  return result;
}

// ─── Handle retry logic (§4.5) ──────────────────────

export function getRetryItem(
  originalItem: SessionItem,
  attemptCount: number
): SessionItem | null {
  if (attemptCount >= 2) return null;

  const easierType = getEasierExercise(originalItem.exerciseType);
  return {
    wordProgress: originalItem.wordProgress,
    exerciseType: easierType,
    trackDirection: originalItem.trackDirection,
  };
}

function getEasierExercise(current: string): SessionItem["exerciseType"] {
  switch (current) {
    case "context_production": return "translation";
    case "translation": return "quiz";
    case "quiz": return "matching";
    case "listening": return "matching";
    case "matching": return "reverse_typing";
    case "reverse_typing": return "flashcard";
    default: return "flashcard";
  }
}

// ─── Helpers ────────────────────────────────────────

function isDue(wp: WordProgress): boolean {
  if (!wp.nextReview) return true;
  return wp.nextReview.toMillis() <= Date.now();
}

const MAX_WEEKLY_REVIEWS = 5;

function getDueWords(words: WordProgress[]): WordProgress[] {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return words
    .filter((w) => {
      if (w.state === "mastered" || w.state === "new") return false;
      if (!w.nextReview) return true;
      if (w.nextReview.toMillis() > now) return false;

      if (
        w.weeklyReviewCount >= MAX_WEEKLY_REVIEWS &&
        w.lastWeeklyReset &&
        (now - w.lastWeeklyReset.toMillis()) <= sevenDaysMs
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by retrievability ascending (lowest first = most urgent)
      const rA = a.lastReview && a.stability > 0
        ? Math.pow(1 + (now - a.lastReview.toMillis()) / (9 * a.stability * 86400000), -1)
        : 0;
      const rB = b.lastReview && b.stability > 0
        ? Math.pow(1 + (now - b.lastReview.toMillis()) / (9 * b.stability * 86400000), -1)
        : 0;
      return rA - rB;
    });
}
