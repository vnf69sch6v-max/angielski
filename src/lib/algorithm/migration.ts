/**
 * Migration — auto-migrates existing WordProgress documents to V2 dual-track format
 * RULE: Only ADDS new fields. Never modifies or deletes legacy fields.
 */
import { WordProgress, TrackData, OverallMastery } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

// ─── Check if migration is needed ────────────────────

export function needsMigration(wp: WordProgress): boolean {
  return !wp.tracks;
}

// ─── Create empty track data ─────────────────────────

function createEmptyTrack(): TrackData {
  return {
    stability: 0,
    difficulty: 0,
    retrievability: 0,
    nextReview: Timestamp.now(),
    lastReview: null,
    state: "new",
    learningStep: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    accuracy: 0,
  };
}

// ─── Migrate a single word to V2 ─────────────────────

export function migrateWordToV2(wp: WordProgress): WordProgress {
  if (!needsMigration(wp)) return wp;

  // Copy existing FSRS data into recognition track
  const recognition: TrackData = {
    stability: wp.stability,
    difficulty: wp.difficulty,
    retrievability: wp.retrievability,
    nextReview: wp.nextReview,
    lastReview: wp.lastReview,
    state: wp.state,
    learningStep: wp.learningStep,
    totalAttempts: wp.totalAttempts,
    correctAttempts: wp.correctAttempts,
    accuracy: wp.accuracy,
  };

  // Initialize production track as new
  const production: TrackData = createEmptyTrack();

  // Calculate overall mastery based on current state
  let overallMastery: OverallMastery = "partial";
  if (wp.state === "mastered") {
    overallMastery = "passive"; // mastered recognition only → passive
  } else if (wp.state === "new") {
    overallMastery = "partial";
  }

  return {
    ...wp,
    tracks: { recognition, production },
    overallMastery,
    isLeech: false,
    leechTrack: null,
    contextCache: null,
  };
}

// ─── Migrate all words in batch ──────────────────────

export function migrateAllWords(words: WordProgress[]): WordProgress[] {
  return words.map(migrateWordToV2);
}

// ─── Compute overall mastery from both tracks ────────

export function computeOverallMastery(wp: WordProgress): OverallMastery {
  if (!wp.tracks) return "partial";

  const rec = wp.tracks.recognition;
  const prod = wp.tracks.production;

  const recMastered = rec.state === "mastered";
  const prodMastered = prod.state === "mastered";

  if (recMastered && prodMastered) return "mastered";
  if (prod.accuracy >= 0.80 && prod.state !== "new") return "active";
  if (rec.accuracy >= 0.80 && rec.state !== "new" && prod.accuracy < 0.50) return "passive";
  return "partial";
}
