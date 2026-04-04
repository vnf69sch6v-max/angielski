/**
 * Fatigue Detection Engine — real-time tracking of user fatigue during sessions
 * Based on FluentFlow V2 Extension §5
 */
import { FatigueSensitivity, SessionFatigueData } from "@/lib/types";

export type FatigueLevel = "green" | "yellow" | "orange" | "red";

interface AnswerRecord {
  wasCorrect: boolean;
  responseTimeMs: number;
  timestamp: number;
}

const WINDOW_SIZE = 15;

// Sensitivity multipliers — higher = triggers faster
const SENSITIVITY_MULTIPLIERS: Record<FatigueSensitivity, number> = {
  low: 0.7,
  medium: 1.0,
  high: 1.4,
};

export class FatigueTracker {
  private answers: AnswerRecord[] = [];
  private smoothedScore = 0;
  private sessionStartTime: number;
  private fatigueOnsetTime: number | null = null;
  private wordsBeforeOnset = 0;
  private sensitivity: number;

  constructor(sensitivity: FatigueSensitivity = "medium") {
    this.sessionStartTime = Date.now();
    this.sensitivity = SENSITIVITY_MULTIPLIERS[sensitivity];
  }

  // ─── Add an answer to the tracker ────────────────

  addAnswer(wasCorrect: boolean, responseTimeMs: number): void {
    this.answers.push({
      wasCorrect,
      responseTimeMs,
      timestamp: Date.now(),
    });
  }

  // ─── Get composite fatigue score (0.0 - 1.0) ────

  getFatigueScore(): number {
    if (this.answers.length < WINDOW_SIZE) return 0;

    // Baseline: first 15 answers
    const baseline = this.answers.slice(0, WINDOW_SIZE);
    const baselineAccuracy = baseline.filter((a) => a.wasCorrect).length / WINDOW_SIZE;
    const baselineRT =
      baseline.reduce((sum, a) => sum + a.responseTimeMs, 0) / WINDOW_SIZE;

    // Rolling: last 15 answers
    const rolling = this.answers.slice(-WINDOW_SIZE);
    const rollingAccuracy = rolling.filter((a) => a.wasCorrect).length / WINDOW_SIZE;
    const rollingRT =
      rolling.reduce((sum, a) => sum + a.responseTimeMs, 0) / WINDOW_SIZE;

    // 1. Accuracy component (weight: 0.5)
    const accuracyDrop = Math.max(0, baselineAccuracy - rollingAccuracy);
    const accuracyFatigue = Math.min(1.0, accuracyDrop / 0.30);

    // 2. Response time component (weight: 0.3)
    const rtIncrease = baselineRT > 0 ? Math.max(0, (rollingRT - baselineRT) / baselineRT) : 0;
    const rtFatigue = Math.min(1.0, rtIncrease / 0.50);

    // 3. Streak component (weight: 0.2)
    const last10 = this.answers.slice(-10);
    let recentWrongStreak = 0;
    for (let i = last10.length - 1; i >= 0; i--) {
      if (!last10[i].wasCorrect) recentWrongStreak++;
      else break;
    }
    const streakFatigue = Math.min(1.0, recentWrongStreak / 5);

    // Composite
    const rawScore =
      accuracyFatigue * 0.5 + rtFatigue * 0.3 + streakFatigue * 0.2;

    // Apply sensitivity multiplier
    const adjusted = Math.min(1.0, rawScore * this.sensitivity);

    // EMA smoothing (alpha = 0.3)
    this.smoothedScore = 0.3 * adjusted + 0.7 * this.smoothedScore;

    // Track onset
    if (this.smoothedScore > 0.3 && this.fatigueOnsetTime === null) {
      this.fatigueOnsetTime = Date.now();
      this.wordsBeforeOnset = this.answers.length;
    }

    return this.smoothedScore;
  }

  // ─── Get fatigue level based on thresholds ───────

  getFatigueLevel(): FatigueLevel {
    const score = this.smoothedScore;
    if (score > 0.7) return "red";
    if (score > 0.5) return "orange";
    if (score > 0.3) return "yellow";
    return "green";
  }

  // ─── Gate new words based on fatigue ─────────────

  getNewWordGate(lastFiveCorrect: boolean): number {
    const score = this.smoothedScore;
    if (score > 0.7) return 0;
    if (score > 0.5) return lastFiveCorrect ? 1 : 0;
    if (score > 0.3) return 1;
    return 3;
  }

  // ─── Should exercises be downgraded? ─────────────

  shouldDowngradeExercises(): boolean {
    return this.smoothedScore > 0.5;
  }

  // ─── Should force light mode (flashcards only)? ──

  shouldForceLightMode(): boolean {
    return this.smoothedScore > 0.7;
  }

  // ─── Get FSRS weight multiplier ──────────────────

  getFsrsWeightMultiplier(): number {
    return this.smoothedScore > 0.7 ? 0.5 : 1.0;
  }

  // ─── Get accuracy stats for UI banner ────────────

  getAccuracyStats(): { baseline: number; current: number } | null {
    if (this.answers.length < WINDOW_SIZE) return null;

    const baseline = this.answers.slice(0, WINDOW_SIZE);
    const baselineAcc = baseline.filter((a) => a.wasCorrect).length / WINDOW_SIZE;

    const rolling = this.answers.slice(-WINDOW_SIZE);
    const rollingAcc = rolling.filter((a) => a.wasCorrect).length / WINDOW_SIZE;

    return {
      baseline: Math.round(baselineAcc * 100),
      current: Math.round(rollingAcc * 100),
    };
  }

  // ─── Get session fatigue data for saving ─────────

  getSessionFatigueData(): SessionFatigueData {
    const onsetMinute = this.fatigueOnsetTime
      ? Math.round((this.fatigueOnsetTime - this.sessionStartTime) / 60000)
      : null;

    // Calculate accuracy before/after fatigue
    let accBefore = 0;
    let accAfter = 0;

    if (this.wordsBeforeOnset > 0 && this.fatigueOnsetTime) {
      const before = this.answers.slice(0, this.wordsBeforeOnset);
      accBefore = before.filter((a) => a.wasCorrect).length / before.length;

      const after = this.answers.slice(this.wordsBeforeOnset);
      accAfter = after.length > 0
        ? after.filter((a) => a.wasCorrect).length / after.length
        : 0;
    } else {
      accBefore = this.answers.length > 0
        ? this.answers.filter((a) => a.wasCorrect).length / this.answers.length
        : 0;
    }

    return {
      fatigueOnsetMinute: onsetMinute,
      wordsBeforeFatigue: this.wordsBeforeOnset || this.answers.length,
      accuracyBeforeFatigue: Math.round(accBefore * 100) / 100,
      accuracyAfterFatigue: Math.round(accAfter * 100) / 100,
      timeOfDay: new Date(this.sessionStartTime).getHours(),
      peakFatigueScore: Math.round(this.smoothedScore * 100) / 100,
    };
  }

  // ─── Total answers count ─────────────────────────

  get totalAnswers(): number {
    return this.answers.length;
  }

  // ─── Were the last 5 answers correct? ────────────

  get lastFiveCorrect(): boolean {
    if (this.answers.length < 5) return true;
    return this.answers.slice(-5).every((a) => a.wasCorrect);
  }
}
