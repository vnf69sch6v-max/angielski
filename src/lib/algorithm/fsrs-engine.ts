/**
 * FSRS Engine — core spaced repetition scheduling via ts-fsrs
 * Based on FluentFlow Algorithm Spec §2
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, Card, State, Grade } from "ts-fsrs";
import { WordProgress, WordState } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

// ─── FSRS Configuration (§2.5) ───────────────────────

const params = generatorParameters({
  request_retention: 0.95,
  maximum_interval: 365,
});
const scheduler = fsrs(params);

// ─── Learning Steps in minutes (§3.3) ────────────────

const LEARNING_STEPS = [5, 30, 1440, 4320]; // 5min, 30min, 1day, 3days
const RELEARNING_STEPS = [10]; // 10 minutes (§3.5)

// ─── Initialize a new word (§3.2) ────────────────────

export function initializeWord(wordProgress: WordProgress): WordProgress {
  const card = createEmptyCard();
  return {
    ...wordProgress,
    state: "learning",
    stability: card.stability,
    difficulty: card.difficulty,
    retrievability: 0,
    nextReview: Timestamp.fromMillis(Date.now()),
    lastReview: null,
    learningStep: 0,
    exerciseLevel: 1,
    consecutiveCorrect: 0,
  };
}

// ─── Review a word (§3.3-3.6, §2.4) ─────────────────

export function reviewWord(
  wp: WordProgress,
  rating: 1 | 2 | 3 | 4
): WordProgress {
  const now = new Date();
  const updated = { ...wp };

  switch (wp.state) {
    case "new":
    case "learning": {
      updated.lastReview = Timestamp.now();
      if (rating >= 3) {
        updated.learningStep = Math.min(wp.learningStep + 1, LEARNING_STEPS.length);
        updated.consecutiveCorrect = wp.consecutiveCorrect + 1;

        if (updated.learningStep >= LEARNING_STEPS.length) {
          // §3.3 Graduacja → REVIEW
          updated.state = "review";
          const card = buildFsrsCard(wp);
          const result = scheduler.repeat(card, now);
          const scheduled = result[ratingToFsrs(rating)].card;
          updated.stability = scheduled.stability;
          updated.difficulty = scheduled.difficulty;
          updated.nextReview = Timestamp.fromDate(scheduled.due);
        } else {
          const stepMinutes = LEARNING_STEPS[updated.learningStep];
          updated.nextReview = Timestamp.fromMillis(Date.now() + stepMinutes * 60 * 1000);
        }
      } else {
        // §3.3: Błąd — cofnij o 1 krok (nie reset!)
        updated.learningStep = Math.max(0, wp.learningStep - 1);
        updated.consecutiveCorrect = 0;
        const stepMinutes = LEARNING_STEPS[updated.learningStep];
        updated.nextReview = Timestamp.fromMillis(Date.now() + stepMinutes * 60 * 1000);
      }
      break;
    }

    case "review": {
      updated.lastReview = Timestamp.now();
      if (rating === 1) {
        // §3.5: Again → relearning
        updated.state = "relearning";
        updated.consecutiveCorrect = 0;
        updated.learningStep = 0;
        updated.nextReview = Timestamp.fromMillis(Date.now() + RELEARNING_STEPS[0] * 60 * 1000);
      } else {
        const card = buildFsrsCard(wp);
        const result = scheduler.repeat(card, now);
        const scheduled = result[ratingToFsrs(rating)].card;
        updated.stability = scheduled.stability;
        updated.difficulty = scheduled.difficulty;
        updated.nextReview = Timestamp.fromDate(scheduled.due);
        updated.consecutiveCorrect = wp.consecutiveCorrect + 1;

        // §3.6: Mastered — 90 days without error
        if (
          wp.dateFirstCorrect &&
          (Date.now() - wp.dateFirstCorrect.toMillis()) / (24 * 60 * 60 * 1000) >= 90 &&
          updated.consecutiveCorrect >= 10 &&
          wp.accuracy >= 0.90
        ) {
          updated.state = "mastered";
          updated.dateMastered = Timestamp.now();
        }
      }
      break;
    }

    case "relearning": {
      updated.lastReview = Timestamp.now();
      if (rating >= 3) {
        updated.state = "review";
        updated.consecutiveCorrect = 1;
        const card = buildFsrsCard(wp);
        const result = scheduler.repeat(card, now);
        const scheduled = result[ratingToFsrs(rating)].card;
        updated.stability = scheduled.stability;
        updated.difficulty = scheduled.difficulty;
        updated.nextReview = Timestamp.fromDate(scheduled.due);
      } else {
        updated.consecutiveCorrect = 0;
        updated.nextReview = Timestamp.fromMillis(Date.now() + RELEARNING_STEPS[0] * 60 * 1000);
      }
      break;
    }

    case "mastered": {
      updated.lastReview = Timestamp.now();
      if (rating <= 2) {
        // §3.6: Failed spot-check → back to review with S=30
        updated.state = "review";
        updated.consecutiveCorrect = 0;
        updated.dateMastered = null;
        updated.stability = 30;
        updated.nextReview = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
      } else {
        const card = buildFsrsCard(wp);
        const result = scheduler.repeat(card, now);
        const scheduled = result[ratingToFsrs(rating)].card;
        updated.nextReview = Timestamp.fromDate(scheduled.due);
      }
      break;
    }
  }

  // Update stats
  updated.totalAttempts = wp.totalAttempts + 1;
  if (rating >= 3) {
    updated.correctAttempts = wp.correctAttempts + 1;
    if (wp.dateFirstCorrect === null) updated.dateFirstCorrect = Timestamp.now();
  } else {
    updated.timesWrongTotal = wp.timesWrongTotal + 1;
  }
  updated.accuracy = updated.totalAttempts > 0 ? updated.correctAttempts / updated.totalAttempts : 0;

  return updated;
}

// ─── Get due words sorted by retrievability (§4.3) ───

export function getDueWords(allWords: WordProgress[]): WordProgress[] {
  const now = Date.now();
  return allWords
    .filter((w) => {
      if (w.state === "mastered" || w.state === "new") return false;
      if (!w.nextReview) return true;
      return w.nextReview.toMillis() <= now;
    })
    .sort((a, b) => calculateRetrievability(a) - calculateRetrievability(b));
}

// ─── Calculate current retrievability (§2.3) ─────────

export function calculateRetrievability(wp: WordProgress): number {
  if (!wp.lastReview || wp.stability <= 0) return 0;
  const daysSinceReview = (Date.now() - wp.lastReview.toMillis()) / (1000 * 60 * 60 * 24);
  // §2.3: R = (1 + t/(9*S))^(-1)
  return Math.pow(1 + daysSinceReview / (9 * wp.stability), -1);
}

// ─── Helpers ─────────────────────────────────────────

function ratingToFsrs(rating: 1 | 2 | 3 | 4): Grade {
  const map: Record<number, Grade> = { 
    1: Rating.Again as Grade, 
    2: Rating.Hard as Grade, 
    3: Rating.Good as Grade, 
    4: Rating.Easy as Grade 
  };
  return map[rating];
}

function stateToFsrs(state: WordState): State {
  const map: Record<WordState, State> = {
    new: State.New, learning: State.Learning, review: State.Review,
    relearning: State.Relearning, mastered: State.Review,
  };
  return map[state];
}

function buildFsrsCard(wp: WordProgress): Card {
  const card = createEmptyCard();
  return {
    ...card,
    stability: wp.stability || card.stability,
    difficulty: wp.difficulty || card.difficulty,
    state: stateToFsrs(wp.state),
    due: wp.nextReview ? wp.nextReview.toDate() : new Date(),
    last_review: wp.lastReview ? wp.lastReview.toDate() : undefined,
    reps: wp.totalAttempts,
    lapses: wp.timesWrongTotal,
  } as Card;
}
