/**
 * Leech Detection — identifies and handles "leech" words that resist learning
 * Based on FluentFlow V2 Extension §6
 */
import { WordProgress, TrackDirection } from "@/lib/types";

const LEECH_WRONG_THRESHOLD = 5;
const LEECH_ACCURACY_THRESHOLD = 0.50;
const LEECH_EXIT_ACCURACY = 0.90;
const LEECH_EXIT_MIN_ATTEMPTS = 10;
const MAX_LEECHES_PER_SESSION = 5;

// ─── Check if a word is a leech on a given track ─────

export function isLeechOnTrack(
  wp: WordProgress,
  track: TrackDirection
): boolean {
  if (!wp.tracks) {
    // Legacy check: use global fields
    return (
      wp.timesWrongTotal >= LEECH_WRONG_THRESHOLD &&
      wp.accuracy < LEECH_ACCURACY_THRESHOLD &&
      wp.state !== "new"
    );
  }

  const trackData = wp.tracks[track];
  const wrongCount = trackData.totalAttempts - trackData.correctAttempts;

  return (
    wrongCount >= LEECH_WRONG_THRESHOLD &&
    trackData.accuracy < LEECH_ACCURACY_THRESHOLD &&
    trackData.state !== "new"
  );
}

// ─── Check if a word is a leech on either track ─────

export function isLeech(wp: WordProgress): boolean {
  if (!wp.tracks) {
    return (
      wp.timesWrongTotal >= LEECH_WRONG_THRESHOLD &&
      wp.accuracy < LEECH_ACCURACY_THRESHOLD &&
      wp.state !== "new"
    );
  }

  return isLeechOnTrack(wp, "recognition") || isLeechOnTrack(wp, "production");
}

// ─── Get which track is the leech track ──────────────

export function getLeechTrack(wp: WordProgress): TrackDirection | null {
  if (!wp.tracks) {
    return isLeech(wp) ? "recognition" : null;
  }

  if (isLeechOnTrack(wp, "production")) return "production";
  if (isLeechOnTrack(wp, "recognition")) return "recognition";
  return null;
}

// ─── Check if leech has recovered ────────────────────

export function hasExitedLeech(wp: WordProgress, track: TrackDirection): boolean {
  if (!wp.tracks) {
    return wp.accuracy >= LEECH_EXIT_ACCURACY && wp.totalAttempts >= LEECH_EXIT_MIN_ATTEMPTS;
  }

  const trackData = wp.tracks[track];
  return (
    trackData.accuracy >= LEECH_EXIT_ACCURACY &&
    trackData.totalAttempts >= LEECH_EXIT_MIN_ATTEMPTS
  );
}

// ─── Get all leech words from the pool ───────────────

export function getLeechWords(allWords: WordProgress[]): WordProgress[] {
  return allWords.filter(isLeech);
}

// ─── Get leech words for a session (max 5) ───────────

export function getLeechWordsForSession(allWords: WordProgress[]): WordProgress[] {
  const leeches = getLeechWords(allWords);

  // Sort by accuracy ascending (worst first)
  const sorted = leeches.sort((a, b) => {
    const accA = a.tracks ? Math.min(a.tracks.recognition.accuracy, a.tracks.production.accuracy) : a.accuracy;
    const accB = b.tracks ? Math.min(b.tracks.recognition.accuracy, b.tracks.production.accuracy) : b.accuracy;
    return accA - accB;
  });

  return sorted.slice(0, MAX_LEECHES_PER_SESSION);
}

// ─── Update leech status after review ────────────────

export function updateLeechStatus(wp: WordProgress): WordProgress {
  const updated = { ...wp };

  const leechTrack = getLeechTrack(updated);

  if (leechTrack) {
    updated.isLeech = true;
    updated.leechTrack = leechTrack;
  } else if (updated.isLeech) {
    // Check if previously a leech but now recovered
    const prevTrack = updated.leechTrack || "recognition";
    if (hasExitedLeech(updated, prevTrack)) {
      updated.isLeech = false;
      updated.leechTrack = null;

      // Reset stability to 3 days on exit
      if (updated.tracks) {
        updated.tracks[prevTrack].stability = 3;
      } else {
        updated.stability = 3;
      }
    }
  }

  return updated;
}
