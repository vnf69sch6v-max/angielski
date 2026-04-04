/**
 * Session Enjoyment Score — behavioral signals measuring session quality
 * FluentFlow v3.1 §4.1
 *
 * No user survey needed. Pure behavioral measurement from 5 signals.
 */
import { AnswerResult } from "@/lib/types";

// ─── Types ───────────────────────────────────────────

export interface SessionEnjoymentSignals {
  flowScore: number;             // 0-1: stable response rhythm
  completionScore: number;       // 0-1: voluntary completion vs escape
  engagementScore: number;       // 0-1: above-minimum behavior (re-flip, longer sessions)
  accuracyStabilityScore: number;// 0-1: stable accuracy through session
  returnScore: number;           // 0-1: comes back next day (delayed signal)
  enjoymentScore: number;        // composite 0-10
}

// ─── Calculate enjoyment from session data ──────────

export function calculateEnjoymentScore(
  answers: AnswerResult[],
  durationMs: number,
  wordsReviewed: number,
  completedVoluntarily: boolean,
  optimalLength?: number | null,
  previousReturnScore?: number
): SessionEnjoymentSignals {
  // 1. FLOW SCORE: stable response rhythm
  let flowScore = 0.5;
  if (answers.length >= 5) {
    const times = answers.map((a) => a.responseTimeMs).filter((t) => t > 0);
    if (times.length >= 3) {
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
      const stddev = Math.sqrt(variance);
      // Lower stddev relative to mean = higher flow
      flowScore = Math.max(0, Math.min(1, 1 - stddev / (mean || 1)));
    }
  }

  // 2. COMPLETION SCORE: voluntary ending
  let completionScore = 0.5;
  if (completedVoluntarily) {
    if (wordsReviewed >= 30) completionScore = 1.0;
    else if (wordsReviewed >= 15) completionScore = 0.7;
    else if (wordsReviewed >= 5) completionScore = 0.3;
    else completionScore = 0.2;
  } else {
    completionScore = 0.0; // abandoned
  }

  // 3. ENGAGEMENT SCORE: above-minimum behavior
  let engagementScore = 0.3;
  const reFlipCount = answers.filter((a) => a.reFlipUsed).length;
  if (reFlipCount > 0) engagementScore += 0.2;
  if (optimalLength && wordsReviewed > optimalLength) engagementScore += 0.3;
  if (durationMs > 5 * 60 * 1000) engagementScore += 0.1; // > 5 minute session
  engagementScore = Math.min(1, engagementScore);

  // 4. ACCURACY STABILITY: steady accuracy through session
  let accuracyStabilityScore = 0.5;
  if (answers.length >= 10) {
    const half = Math.floor(answers.length / 2);
    const firstHalfAcc = answers.slice(0, half).filter((a) => a.wasCorrect).length / half;
    const secondHalfAcc = answers.slice(half).filter((a) => a.wasCorrect).length / (answers.length - half);
    const drop = firstHalfAcc - secondHalfAcc;

    if (Math.abs(drop) < 0.1) {
      // Stable — but check if TOO easy
      const overallAcc = answers.filter((a) => a.wasCorrect).length / answers.length;
      accuracyStabilityScore = overallAcc > 0.95 ? 0.5 : 1.0; // > 95% = too easy = boring
    } else if (drop > 0.2) {
      accuracyStabilityScore = 0.3; // big drop = fatigue/too hard
    } else {
      accuracyStabilityScore = 0.7;
    }
  }

  // 5. RETURN SCORE: delayed signal (passed from previous data)
  const returnScore = previousReturnScore ?? 0.5;

  // COMPOSITE: weighted average → scale to 0-10
  const composite =
    flowScore * 0.25 +
    completionScore * 0.15 +
    engagementScore * 0.15 +
    accuracyStabilityScore * 0.20 +
    returnScore * 0.25;

  const enjoymentScore = Math.round(composite * 100) / 10; // 0-10

  return {
    flowScore,
    completionScore,
    engagementScore,
    accuracyStabilityScore,
    returnScore,
    enjoymentScore,
  };
}

/**
 * Calculate return score for YESTERDAY's session.
 * Call once per day with yesterday's session data.
 */
export function calculateReturnScore(
  lastSessionDate: string | undefined,
  todayDateString: string,
  yesterdayDateString: string
): number {
  if (!lastSessionDate) return 0;
  if (lastSessionDate === todayDateString) return 1.0; // came back today
  if (lastSessionDate === yesterdayDateString) return 0.7;
  // Calculate days since
  const last = new Date(lastSessionDate).getTime();
  const today = new Date(todayDateString).getTime();
  const daysSince = (today - last) / (24 * 60 * 60 * 1000);
  if (daysSince <= 3) return 0.3;
  return 0;
}
