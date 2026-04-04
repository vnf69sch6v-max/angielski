/**
 * Word Recommendation Score — multi-factor scoring for intelligent word selection
 * Based on FluentFlow V3 §9
 */
import { WordProgress, Domain } from "@/lib/types";

// ─── Session Context ─────────────────────────────────

export interface SessionContext {
  lastWord: WordProgress | null;
  lastMistake: WordProgress | null;
  lastDomains: Domain[];
  wordsSeenThisSession: Set<string>;
  currentFatigueScore: number;
  sessionWordCount: number;
}

export function createSessionContext(): SessionContext {
  return {
    lastWord: null,
    lastMistake: null,
    lastDomains: [],
    wordsSeenThisSession: new Set(),
    currentFatigueScore: 0,
    sessionWordCount: 0,
  };
}

// ─── Scoring function ────────────────────────────────

/**
 * Calculate a multi-factor recommendation score for a word.
 * Higher score = higher priority to show next.
 */
export function calculateWordScore(
  word: WordProgress,
  context: SessionContext,
  domainStrengths?: Record<Domain, { accuracy: number }>,
  wordConnections?: Set<string>
): number {
  let score = 0;

  // Determine which track to evaluate
  const track = word.tracks
    ? (word.tracks.production.nextReview &&
       word.tracks.production.nextReview.toMillis() <= Date.now()
        ? "production"
        : "recognition")
    : null;

  const trackData = track && word.tracks ? word.tracks[track] : null;

  // 1. URGENCY — how overdue (0-30 pts)
  const nextReview = trackData?.nextReview || word.nextReview;
  if (nextReview) {
    const daysOverdue = Math.max(0, (Date.now() - nextReview.toMillis()) / (24 * 60 * 60 * 1000));
    score += Math.min(30, daysOverdue * 3);
  }

  // 2. WEAKNESS — low accuracy = higher priority (0-25 pts)
  const accuracy = trackData?.accuracy ?? word.accuracy;
  const weakness = 1 - accuracy;
  score += weakness * 25;

  // 3. DOMAIN NEED — from weakest domain (0-15 pts)
  if (domainStrengths && word.domain && domainStrengths[word.domain]) {
    const domainWeakness = 1 - domainStrengths[word.domain].accuracy;
    score += domainWeakness * 15;
  }

  // 4. CONNECTION BONUS — related to last word/mistake (0-20 pts)
  if (wordConnections) {
    if (context.lastWord && wordConnections.has(context.lastWord.wordId)) {
      score += 10;
    }
    if (context.lastMistake && wordConnections.has(context.lastMistake.wordId)) {
      score += 20;
    }
  }

  // 5. FRESHNESS — long unseen = bonus (0-10 pts)
  const lastReview = trackData?.lastReview || word.lastReview;
  if (lastReview) {
    const daysSinceLastSeen = (Date.now() - lastReview.toMillis()) / (24 * 60 * 60 * 1000);
    score += Math.min(10, daysSinceLastSeen * 0.5);
  }

  // 6. ANTI-MONOTONY — penalty for same domain 3x in a row (-10 pts)
  if (
    context.lastDomains.length >= 2 &&
    context.lastDomains.slice(-2).every((d) => d === word.domain)
  ) {
    score -= 10;
  }

  // 7. PRODUCTION GAP BONUS — big gap recognition vs production (0-15 pts)
  if (word.tracks) {
    const gap = word.tracks.recognition.accuracy - word.tracks.production.accuracy;
    if (gap > 0.2) score += 15;
    else if (gap > 0.1) score += 8;
  }

  return score;
}

// ─── Rank due words ──────────────────────────────────

/**
 * Rank an array of due words by recommendation score.
 * Returns words sorted by score descending (best first).
 */
export function rankDueWords(
  words: WordProgress[],
  context: SessionContext,
  domainStrengths?: Record<Domain, { accuracy: number }>,
  wordConnectionsMap?: Map<string, Set<string>>
): WordProgress[] {
  return words
    .filter((w) => !context.wordsSeenThisSession.has(w.wordId))
    .map((w) => ({
      word: w,
      score: calculateWordScore(
        w,
        context,
        domainStrengths,
        wordConnectionsMap?.get(w.wordId)
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.word);
}

/**
 * Update session context after an answer.
 */
export function updateSessionContext(
  context: SessionContext,
  word: WordProgress,
  wasCorrect: boolean,
  fatigueScore: number
): SessionContext {
  const updated = { ...context };
  updated.lastWord = word;
  if (!wasCorrect) {
    updated.lastMistake = word;
  }
  updated.lastDomains = [...context.lastDomains.slice(-4), word.domain];
  updated.wordsSeenThisSession.add(word.wordId);
  updated.currentFatigueScore = fatigueScore;
  updated.sessionWordCount += 1;
  return updated;
}
