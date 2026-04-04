/**
 * FSRS Engine — core spaced repetition scheduling via ts-fsrs
 * Based on FluentFlow Algorithm Spec §2
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, Card, State, Grade } from "ts-fsrs";
import { WordProgress, WordState, TrackDirection } from "@/lib/types";
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
  rating: 1 | 2 | 3 | 4,
  trackDirection?: TrackDirection
): WordProgress {
  const now = new Date();
  const updated = { ...wp };

  let activeState = wp.state;
  let activeLearningStep = wp.learningStep;
  let activeConsecutiveCorrect = wp.consecutiveCorrect;

  if (trackDirection && wp.tracks) {
    const t = wp.tracks[trackDirection];
    activeState = t.state || "new";
    activeLearningStep = t.learningStep || 0;
    activeConsecutiveCorrect = t.correctAttempts || wp.consecutiveCorrect; // Fallback to global 
  }

  // Update these explicitly so we can re-assign them to track later
  let nextState = activeState;
  let nextLearningStep = activeLearningStep;
  let nextConsecutiveCorrect = activeConsecutiveCorrect;
  let nextStability = wp.stability;
  let nextDifficulty = wp.difficulty;
  let nextReviewDate = wp.nextReview;
  let dateMastered = wp.dateMastered;

  switch (activeState) {
    case "new":
    case "learning": {
      updated.lastReview = Timestamp.now();
      if (rating >= 3) {
        // §3.3 Fast Graduation: rating 4 skips learning entirely
        if (rating === 4) {
          nextLearningStep = LEARNING_STEPS.length;
        } else {
          nextLearningStep = Math.min(activeLearningStep + 1, LEARNING_STEPS.length);
        }
        
        nextConsecutiveCorrect = activeConsecutiveCorrect + 1;

        if (nextLearningStep >= LEARNING_STEPS.length) {
          // §3.3 Graduacja → REVIEW
          nextState = "review";
          const card = buildFsrsCard(wp, trackDirection);
          const result = scheduler.repeat(card, now);
          const scheduled = result[ratingToFsrs(rating)].card;
          nextStability = scheduled.stability;
          nextDifficulty = scheduled.difficulty;
          nextReviewDate = Timestamp.fromDate(scheduled.due);
        } else {
          const stepMinutes = LEARNING_STEPS[nextLearningStep];
          nextReviewDate = Timestamp.fromMillis(Date.now() + stepMinutes * 60 * 1000);
        }
      } else {
        // §3.3: Błąd — cofnij o 1 krok (nie reset!)
        nextLearningStep = Math.max(0, activeLearningStep - 1);
        nextConsecutiveCorrect = 0;
        const stepMinutes = LEARNING_STEPS[nextLearningStep];
        nextReviewDate = Timestamp.fromMillis(Date.now() + stepMinutes * 60 * 1000);
      }
      break;
    }

    case "review": {
      updated.lastReview = Timestamp.now();
      if (rating === 1) {
        // §3.5: Again → relearning
        nextState = "relearning";
        nextConsecutiveCorrect = 0;
        nextLearningStep = 0;
        nextReviewDate = Timestamp.fromMillis(Date.now() + RELEARNING_STEPS[0] * 60 * 1000);
      } else {
        const card = buildFsrsCard(wp, trackDirection);
        const result = scheduler.repeat(card, now);
        const scheduled = result[ratingToFsrs(rating)].card;
        nextStability = scheduled.stability;
        nextDifficulty = scheduled.difficulty;
        nextReviewDate = Timestamp.fromDate(scheduled.due);
        nextConsecutiveCorrect = activeConsecutiveCorrect + 1;

        // §3.6: Mastered — 90 days without error
        if (
          wp.dateFirstCorrect &&
          (Date.now() - wp.dateFirstCorrect.toMillis()) / (24 * 60 * 60 * 1000) >= 90 &&
          nextConsecutiveCorrect >= 10 &&
          wp.accuracy >= 0.90
        ) {
          nextState = "mastered";
          dateMastered = Timestamp.now();
        }
      }
      break;
    }

    case "relearning": {
      updated.lastReview = Timestamp.now();
      if (rating >= 3) {
        nextState = "review";
        nextConsecutiveCorrect = 1;
        const card = buildFsrsCard(wp, trackDirection);
        const result = scheduler.repeat(card, now);
        const scheduled = result[ratingToFsrs(rating)].card;
        nextStability = scheduled.stability;
        nextDifficulty = scheduled.difficulty;
        nextReviewDate = Timestamp.fromDate(scheduled.due);
      } else {
        nextConsecutiveCorrect = 0;
        nextReviewDate = Timestamp.fromMillis(Date.now() + RELEARNING_STEPS[0] * 60 * 1000);
      }
      break;
    }

    case "mastered": {
      updated.lastReview = Timestamp.now();
      if (rating <= 2) {
        // §3.6: Failed spot-check → back to review with S=30
        nextState = "review";
        nextConsecutiveCorrect = 0;
        dateMastered = null;
        nextStability = 30;
        nextReviewDate = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
      } else {
        const card = buildFsrsCard(wp, trackDirection);
        const result = scheduler.repeat(card, now);
        const scheduled = result[ratingToFsrs(rating)].card;
        nextReviewDate = Timestamp.fromDate(scheduled.due);
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

  // Track specific updates! This is required for Escalator bug fix
  if (trackDirection && updated.tracks) {
    const track = updated.tracks[trackDirection];
    track.totalAttempts += 1;
    if (rating >= 3) {
      track.correctAttempts += 1;
    }
    track.accuracy = track.totalAttempts > 0 ? track.correctAttempts / track.totalAttempts : 0;
    
    // Sync states from what we calculated
    track.state = nextState;
    track.nextReview = nextReviewDate;
    track.stability = nextStability;
    track.difficulty = nextDifficulty;
    track.learningStep = nextLearningStep;
    track.lastReview = updated.lastReview;
  }

  // Also update the global properties so legacy doesn't completely break, 
  // though they'll just represent the state of the *last* done track.
  updated.state = nextState;
  updated.learningStep = nextLearningStep;
  updated.stability = nextStability;
  updated.difficulty = nextDifficulty;
  updated.nextReview = nextReviewDate;
  updated.dateMastered = dateMastered;
  updated.consecutiveCorrect = nextConsecutiveCorrect;

  // V3 FIX 2: Track consecutiveEasy
  if (rating === 4) {
    updated.consecutiveEasy = (wp.consecutiveEasy || 0) + 1;
  } else {
    updated.consecutiveEasy = 0;
  }

  // V3 FIX 2: 5× Easy override — minimum 14-day interval
  const MIN_EASY_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  if (
    (updated.consecutiveEasy || 0) >= 5 &&
    updated.accuracy >= 0.95 &&
    nextReviewDate
  ) {
    const intervalMs = nextReviewDate.toMillis() - Date.now();
    if (intervalMs < MIN_EASY_INTERVAL_MS) {
      nextReviewDate = Timestamp.fromMillis(Date.now() + MIN_EASY_INTERVAL_MS);
      updated.nextReview = nextReviewDate;
      if (trackDirection && updated.tracks) {
        updated.tracks[trackDirection].nextReview = nextReviewDate;
      }
    }
  }

  // V3 FIX 2: FSRS interval logging
  if (typeof window !== 'undefined') {
    const newNext = nextReviewDate ? nextReviewDate.toMillis() : Date.now();
    const intervalDays = Math.round((newNext - Date.now()) / (24 * 60 * 60 * 1000));
    console.log(
      `[FSRS] Word: "${wp.word}", rating: ${rating}, state: ${activeState}→${nextState}, ` +
      `interval: ${intervalDays}d, consecutiveEasy: ${updated.consecutiveEasy || 0}, ` +
      `track: ${trackDirection || 'global'}`
    );
  }

  // §9.3: Weekly repeat limiter — reset counter if >7 days since last reset
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (!wp.lastWeeklyReset || (Date.now() - wp.lastWeeklyReset.toMillis()) > sevenDaysMs) {
    updated.weeklyReviewCount = 1;
    updated.lastWeeklyReset = Timestamp.now();
  } else {
    updated.weeklyReviewCount = (wp.weeklyReviewCount || 0) + 1;
  }

  return updated;
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

function buildFsrsCard(wp: WordProgress, trackDirection?: TrackDirection): Card {
  const card = createEmptyCard();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let source: any = wp;
  
  if (trackDirection && wp.tracks) {
    source = wp.tracks[trackDirection];
  }

  return {
    ...card,
    stability: source.stability || card.stability,
    difficulty: source.difficulty || card.difficulty,
    state: stateToFsrs(source.state || wp.state),
    due: source.nextReview ? source.nextReview.toDate() : new Date(),
    last_review: source.lastReview ? source.lastReview.toDate() : undefined,
    reps: source.totalAttempts || wp.totalAttempts,
    lapses: source.timesWrongTotal || wp.timesWrongTotal,
  } as Card;
}
