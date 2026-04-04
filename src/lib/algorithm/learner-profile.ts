/**
 * Learner Profile — automatic learning pattern analysis
 * Based on FluentFlow V3 §4
 * Updated after EVERY session, NO AI needed.
 */
import {
  LearnerProfile,
  Domain,
  Session,
  DomainStrength,
  TimeSlotStats,
  StrategyScore,
  WordProgress,
} from "@/lib/types";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Default profile ────────────────────────────────

const DEFAULT_STRATEGY_SCORE: StrategyScore = { retention1d: 0, retention7d: 0, trials: 0 };

const DEFAULT_DOMAIN_STRENGTH: DomainStrength = {
  accuracy: 0,
  wordsKnown: 0,
  weakestArea: "",
};

const DEFAULT_TIME_SLOT: TimeSlotStats = {
  avgAccuracy: 0,
  sessionsCount: 0,
};

export function createDefaultProfile(): LearnerProfile {
  const daySlots: Record<number, TimeSlotStats> = {};
  for (let i = 0; i < 7; i++) daySlots[i] = { ...DEFAULT_TIME_SLOT };

  const hourSlots: Record<number, TimeSlotStats> = {};
  for (let i = 0; i < 24; i++) hourSlots[i] = { ...DEFAULT_TIME_SLOT };

  return {
    domainStrength: {
      finance: { ...DEFAULT_DOMAIN_STRENGTH },
      legal: { ...DEFAULT_DOMAIN_STRENGTH },
      smalltalk: { ...DEFAULT_DOMAIN_STRENGTH },
      tech: { ...DEFAULT_DOMAIN_STRENGTH },
    },
    sessionsByDayOfWeek: daySlots,
    sessionsByHour: hourSlots,
    optimalTimeOfDay: null,
    optimalSessionLength: null,
    avgNewWordsPerDay: 0,
    avgRetentionRate1d: 0,
    avgRetentionRate7d: 0,
    learningVelocity: "unknown",
    commonMistakePatterns: [],
    difficultyStrategy: {
      currentStrategy: "random",
      strategyScores: {
        wave: { ...DEFAULT_STRATEGY_SCORE },
        ascending: { ...DEFAULT_STRATEGY_SCORE },
        descending: { ...DEFAULT_STRATEGY_SCORE },
        random: { ...DEFAULT_STRATEGY_SCORE },
      },
    },
    totalSessions: 0,
    totalWordsEverSeen: 0,
    profileLastUpdated: Timestamp.now(),
  };
}

// ─── Helpers ─────────────────────────────────────────

function runningAvg(oldVal: number, newVal: number, alpha: number = 0.3): number {
  if (oldVal === 0) return newVal;
  return alpha * newVal + (1 - alpha) * oldVal;
}

function getWarsawDate(): Date {
  // Return current date adjusted to Warsaw timezone
  const now = new Date();
  const warsawStr = now.toLocaleString("en-US", { timeZone: "Europe/Warsaw" });
  return new Date(warsawStr);
}

// ─── Firestore CRUD ──────────────────────────────────

export async function getLearnerProfile(userId: string): Promise<LearnerProfile> {
  const ref = doc(db, "users", userId, "learnerProfile", "current");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as LearnerProfile;
  }
  return createDefaultProfile();
}

export async function saveLearnerProfile(
  userId: string,
  profile: LearnerProfile
): Promise<void> {
  const ref = doc(db, "users", userId, "learnerProfile", "current");
  await setDoc(ref, profile);
}

// ─── Main update function (called after each session) ─

export interface SessionWordResult {
  wordId: string;
  word: string;
  domain: Domain;
  wasCorrect: boolean;
  rating: number;
}

export async function updateLearnerProfile(
  userId: string,
  sessionData: Session,
  wordResults: SessionWordResult[],
  allWords: WordProgress[]
): Promise<LearnerProfile> {
  const profile = await getLearnerProfile(userId);
  const warsawNow = getWarsawDate();

  // 1. Update domain strength
  const domainGroups: Record<Domain, SessionWordResult[]> = {
    finance: [], legal: [], smalltalk: [], tech: [],
  };
  for (const wr of wordResults) {
    if (domainGroups[wr.domain]) domainGroups[wr.domain].push(wr);
  }

  for (const domain of ["finance", "legal", "smalltalk", "tech"] as Domain[]) {
    const words = domainGroups[domain];
    if (words.length > 0) {
      const correctCount = words.filter((w) => w.wasCorrect).length;
      const sessionAcc = correctCount / words.length;
      profile.domainStrength[domain].accuracy = runningAvg(
        profile.domainStrength[domain].accuracy,
        sessionAcc
      );
      // Count known words (accuracy > 0.7 in that domain)
      profile.domainStrength[domain].wordsKnown = allWords.filter(
        (w) => w.domain === domain && w.accuracy > 0.7 && w.state !== "new"
      ).length;
    }
  }

  // 2. Update time patterns
  const dayOfWeek = warsawNow.getDay();
  const hour = warsawNow.getHours();

  const daySlot = profile.sessionsByDayOfWeek[dayOfWeek] || { ...DEFAULT_TIME_SLOT };
  daySlot.avgAccuracy = runningAvg(daySlot.avgAccuracy, sessionData.accuracyOverall);
  daySlot.sessionsCount += 1;
  daySlot.avgSessionLength = runningAvg(
    daySlot.avgSessionLength || sessionData.wordsReviewed,
    sessionData.wordsReviewed
  );
  profile.sessionsByDayOfWeek[dayOfWeek] = daySlot;

  const hourSlot = profile.sessionsByHour[hour] || { ...DEFAULT_TIME_SLOT };
  hourSlot.avgAccuracy = runningAvg(hourSlot.avgAccuracy, sessionData.accuracyOverall);
  hourSlot.sessionsCount += 1;
  profile.sessionsByHour[hour] = hourSlot;

  // 3. Optimal time of day (after 7+ sessions)
  profile.totalSessions += 1;
  if (profile.totalSessions >= 7) {
    let bestHour = 0;
    let bestAcc = 0;
    for (let h = 0; h < 24; h++) {
      const slot = profile.sessionsByHour[h];
      if (slot && slot.sessionsCount >= 2 && slot.avgAccuracy > bestAcc) {
        bestAcc = slot.avgAccuracy;
        bestHour = h;
      }
    }
    if (bestAcc > 0) profile.optimalTimeOfDay = bestHour;
  }

  // 4. Retention rates (approximate from session accuracy of review words)
  const reviewWords = allWords.filter((w) => w.state === "review" || w.state === "relearning");
  if (reviewWords.length > 0) {
    // 1-day retention: words last reviewed 1 day ago that are correct now
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const recentReviews = reviewWords.filter(
      (w) => w.lastReview && w.lastReview.toMillis() > twoDaysAgo && w.lastReview.toMillis() < oneDayAgo
    );
    if (recentReviews.length >= 3) {
      const retained = recentReviews.filter((w) => w.accuracy >= 0.6).length;
      profile.avgRetentionRate1d = runningAvg(
        profile.avgRetentionRate1d,
        retained / recentReviews.length,
        0.2
      );
    }

    // 7-day retention
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const weekReviews = reviewWords.filter(
      (w) => w.lastReview && w.lastReview.toMillis() > eightDaysAgo && w.lastReview.toMillis() < sevenDaysAgo
    );
    if (weekReviews.length >= 3) {
      const retained = weekReviews.filter((w) => w.accuracy >= 0.6).length;
      profile.avgRetentionRate7d = runningAvg(
        profile.avgRetentionRate7d,
        retained / weekReviews.length,
        0.2
      );
    }
  }

  // 5. Learning velocity
  if (profile.avgRetentionRate7d > 0.85) {
    profile.learningVelocity = "fast";
  } else if (profile.avgRetentionRate7d > 0.70) {
    profile.learningVelocity = "moderate";
  } else if (profile.totalSessions >= 5) {
    profile.learningVelocity = "slow";
  }

  // 6. Optimal session length (after 5+ sessions)
  if (profile.totalSessions >= 5) {
    // Use fatigue data to estimate optimal word count
    const fatigueOnset = sessionData.fatigueData?.wordsBeforeFatigue;
    if (fatigueOnset && fatigueOnset > 0) {
      profile.optimalSessionLength = runningAvg(
        profile.optimalSessionLength || fatigueOnset,
        fatigueOnset,
        0.3
      );
    }
  }

  // 7. Total words ever seen
  profile.totalWordsEverSeen = allWords.filter((w) => w.state !== "new").length;

  // 8. New words per day (running average)
  profile.avgNewWordsPerDay = runningAvg(
    profile.avgNewWordsPerDay,
    sessionData.newWordsIntroduced,
    0.2
  );

  profile.profileLastUpdated = Timestamp.now();

  // Save
  await saveLearnerProfile(userId, profile);

  return profile;
}
