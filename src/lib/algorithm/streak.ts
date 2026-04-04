/**
 * Streak Engine — timezone-aware streak tracking (Europe/Warsaw)
 * Based on FluentFlow V3 §8
 */

// ─── Date helpers (Europe/Warsaw timezone) ────────────

export function getTodayDateString(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw',
  }).format(new Date());
  // 'sv-SE' locale gives ISO dates like "2026-04-04"
}

export function getYesterdayDateString(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw',
  }).format(yesterday);
}

// ─── Streak check (on dashboard render) ──────────────

export interface StreakData {
  streakDays: number;
  streakLastActiveDate?: string;
  longestStreak?: number;
}

/**
 * Check if streak needs to be reset (called on dashboard load).
 * Returns updated streak data if reset is needed, null otherwise.
 */
export function checkAndResetStreak(profile: StreakData): StreakData | null {
  const today = getTodayDateString();
  const lastActive = profile.streakLastActiveDate;

  if (!lastActive) return null; // never had a session
  if (lastActive === today) return null; // already up to date

  const yesterday = getYesterdayDateString();

  if (lastActive < yesterday) {
    // GAP detected — reset streak
    return {
      ...profile,
      streakDays: 0,
    };
  }

  return null; // lastActive === yesterday, streak is alive but hasn't been incremented yet
}

/**
 * Update streak after session ends (called in handleEndSession).
 * Returns updated profile fields to save to Firestore.
 */
export function onSessionEnd(profile: StreakData): {
  streakDays: number;
  streakLastActiveDate: string;
  longestStreak: number;
} | null {
  const today = getTodayDateString();

  if (profile.streakLastActiveDate === today) {
    // Already counted today
    return null;
  }

  const yesterday = getYesterdayDateString();
  let newStreakDays: number;

  if (
    profile.streakLastActiveDate === yesterday ||
    profile.streakDays === 0
  ) {
    // Continuation from yesterday OR first day after reset
    newStreakDays = profile.streakDays + 1;
  } else if (!profile.streakLastActiveDate) {
    // Very first session ever
    newStreakDays = 1;
  } else {
    // Gap — shouldn't happen if checkAndResetStreak was called, but safety
    newStreakDays = 1;
  }

  const longestStreak = Math.max(
    newStreakDays,
    profile.longestStreak || 0
  );

  return {
    streakDays: newStreakDays,
    streakLastActiveDate: today,
    longestStreak,
  };
}
