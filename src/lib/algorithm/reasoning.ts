/**
 * Word Reasoning — explains why a specific word was chosen
 * FluentFlow v3.1 §4.5
 *
 * Generates a human-readable breakdown of the recommendation score
 * for the ℹ️ modal on the learn page.
 */
import { WordProgress, Domain } from "@/lib/types";
import { SessionContext } from "./recommendation";

// ─── Types ───────────────────────────────────────────

export interface ReasonFactor {
  factor: string;
  score: number;
  explanation: string;
}

export interface WordReasoning {
  wordId: string;
  word: string;
  reasons: ReasonFactor[];
  totalScore: number;
}

// ─── Generate reasoning ─────────────────────────────

export function generateWordReasoning(
  word: WordProgress,
  context: SessionContext,
  domainStrengths?: Record<Domain, { accuracy: number }>,
  wordConnectionIds?: Set<string>
): WordReasoning {
  const reasons: ReasonFactor[] = [];

  // 1. URGENCY
  if (word.nextReview) {
    const daysOverdue = Math.max(0, (Date.now() - word.nextReview.toMillis()) / (24 * 60 * 60 * 1000));
    const score = Math.min(30, daysOverdue * 3);
    if (daysOverdue > 0) {
      reasons.push({
        factor: "Pilność",
        score: Math.round(score),
        explanation: `${Math.round(daysOverdue)} dni po terminie powtórki`,
      });
    }
  }

  // 2. WEAKNESS
  const weakness = 1 - word.accuracy;
  const weakScore = weakness * 25;
  if (weakness > 0.2) {
    reasons.push({
      factor: "Słabość",
      score: Math.round(weakScore),
      explanation: `Accuracy ${Math.round(word.accuracy * 100)}% — wymaga pracy`,
    });
  }

  // 3. DOMAIN NEED
  if (domainStrengths && word.domain && domainStrengths[word.domain]) {
    const domainWeakness = 1 - domainStrengths[word.domain].accuracy;
    const domScore = domainWeakness * 15;
    if (domainWeakness > 0.2) {
      reasons.push({
        factor: "Potrzeba domeny",
        score: Math.round(domScore),
        explanation: `${word.domain} to Twoja ${Math.round(domainStrengths[word.domain].accuracy * 100)}% domena`,
      });
    }
  }

  // 4. CONNECTION BONUS
  if (wordConnectionIds) {
    if (context.lastMistake && wordConnectionIds.has(context.lastMistake.wordId)) {
      reasons.push({
        factor: "Powiązanie",
        score: 20,
        explanation: `Powiązane z "${context.lastMistake.word}" (pomylone wcześniej)`,
      });
    } else if (context.lastWord && wordConnectionIds.has(context.lastWord.wordId)) {
      reasons.push({
        factor: "Powiązanie",
        score: 10,
        explanation: `Powiązane z "${context.lastWord.word}" (ostatnie słowo)`,
      });
    }
  }

  // 5. FRESHNESS
  if (word.lastReview) {
    const daysSince = (Date.now() - word.lastReview.toMillis()) / (24 * 60 * 60 * 1000);
    const freshScore = Math.min(10, daysSince * 0.5);
    if (daysSince > 5) {
      reasons.push({
        factor: "Świeżość",
        score: Math.round(freshScore),
        explanation: `Niewidziane od ${Math.round(daysSince)} dni`,
      });
    }
  }

  // 6. ANTI-MONOTONY
  if (
    context.lastDomains.length >= 2 &&
    context.lastDomains.slice(-2).every((d) => d === word.domain)
  ) {
    reasons.push({
      factor: "Anti-monotonia",
      score: -10,
      explanation: `3× ${word.domain} z rzędu — kara za monotonię`,
    });
  }

  // 7. PRODUCTION GAP
  if (word.tracks) {
    const gap = word.tracks.recognition.accuracy - word.tracks.production.accuracy;
    if (gap > 0.2) {
      reasons.push({
        factor: "Luka produkcji",
        score: 15,
        explanation: `Recognition ${Math.round(word.tracks.recognition.accuracy * 100)}% vs Production ${Math.round(word.tracks.production.accuracy * 100)}%`,
      });
    } else if (gap > 0.1) {
      reasons.push({
        factor: "Luka produkcji",
        score: 8,
        explanation: `Mała luka: rec ${Math.round(word.tracks.recognition.accuracy * 100)}% vs prod ${Math.round(word.tracks.production.accuracy * 100)}%`,
      });
    }
  }

  // If no notable reasons, add a default
  if (reasons.length === 0) {
    reasons.push({
      factor: "Standardowa powtórka",
      score: 5,
      explanation: "Słowo zaplanowane do regularnej powtórki",
    });
  }

  const totalScore = reasons.reduce((sum, r) => sum + r.score, 0);

  return {
    wordId: word.wordId,
    word: word.word,
    reasons,
    totalScore,
  };
}
