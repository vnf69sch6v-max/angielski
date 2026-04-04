/**
 * Streak Engine — timezone-aware streak tracking
 * FluentFlow V3 §8, extended in V3.1 §5
 *
 * V3.1 changes:
 * - Auto-detect timezone from browser (was hardcoded Europe/Warsaw)
 * - Added streakHistory: string[] (last 90 active dates for heatmap)
 * - Added checkStreakDisplay() for dashboard rendering
 */
import { getTodayString, getYesterdayString } from "./data-pipeline";

// ─── Streak check (on dashboard render) ──────────────

export interface StreakData {
  streakDays: number;
  streakLastActiveDate?: string;
  longestStreak?: number;
  streakHistory?: string[];
}

/**
 * Check what streak to DISPLAY on dashboard.
 * Does NOT modify Firestore. Just returns a display value.
 */
export function checkStreakDisplay(profile: StreakData): number {
  const today = getTodayString();
  const yesterday = getYesterdayString();

  if (profile.streakLastActiveDate === today) {
    return profile.streakDays; // already updated today
  }
  if (profile.streakLastActiveDate === yesterday) {
    return profile.streakDays; // streak alive but hasn't grown yet
  }
  // Gap — show 0 but don't reset in DB (reset happens on next session end)
  return 0;
}

/**
 * Check if streak needs to be reset (called on dashboard load).
 * Returns updated streak data if reset is needed, null otherwise.
 */
export function checkAndResetStreak(profile: StreakData): StreakData | null {
  const today = getTodayString();
  const lastActive = profile.streakLastActiveDate;

  if (!lastActive) return null;
  if (lastActive === today) return null;

  const yesterday = getYesterdayString();

  if (lastActive < yesterday) {
    return {
      ...profile,
      streakDays: 0,
    };
  }

  return null;
}

/**
 * Update streak after session ends (called in handleEndSession).
 * Returns updated profile fields to save to Firestore, or null if already counted.
 */
export function onSessionEnd(profile: StreakData): {
  streakDays: number;
  streakLastActiveDate: string;
  longestStreak: number;
  streakHistory: string[];
} | null {
  const today = getTodayString();

  if (profile.streakLastActiveDate === today) {
    return null; // Already counted today
  }

  const yesterday = getYesterdayString();
  let newStreakDays: number;

  if (
    profile.streakLastActiveDate === yesterday ||
    profile.streakDays === 0
  ) {
    newStreakDays = profile.streakDays + 1;
  } else if (!profile.streakLastActiveDate) {
    newStreakDays = 1;
  } else if (profile.streakLastActiveDate > today) {
    // Future date? Bug — reset
    newStreakDays = 1;
  } else {
    // Gap — reset
    newStreakDays = 1;
  }

  const longestStreak = Math.max(newStreakDays, profile.longestStreak || 0);

  // V3.1: Update heatmap history (last 90 active dates)
  const history = [...(profile.streakHistory || []), today].slice(-90);

  return {
    streakDays: newStreakDays,
    streakLastActiveDate: today,
    longestStreak,
    streakHistory: history,
  };
}
