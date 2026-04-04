/**
 * Difficulty Bandit — Multi-Armed Bandit for session ordering strategies
 * Based on FluentFlow V3 §7
 *
 * 4 strategies tested via epsilon-greedy exploration:
 * - wave: 3 easy → 1 hard → 2 easy → 1 hard
 * - ascending: easy first, progressively harder, cooldown at end
 * - descending: hard first (fresh mind), easier later
 * - random: shuffle (control group)
 */
import {
  DifficultyStrategyName,
  LearnerProfile,
  StrategyScore,
  SessionItem,
} from "@/lib/types";

// ─── Strategy picker (epsilon-greedy) ────────────────

export function pickStrategy(profile: LearnerProfile): DifficultyStrategyName {
  const strategies = profile.difficultyStrategy.strategyScores;
  const allTrials = Object.values(strategies).reduce((sum, s) => sum + s.trials, 0);

  // Exploration rate: 20% early, 10% after 30+ trials per strategy
  const minTrials = Math.min(...Object.values(strategies).map((s) => s.trials));
  const epsilon = minTrials >= 30 ? 0.1 : 0.2;

  if (Math.random() < epsilon || allTrials < 20) {
    // EXPLORE: random strategy
    const names: DifficultyStrategyName[] = ["wave", "ascending", "descending", "random"];
    return names[Math.floor(Math.random() * names.length)];
  }

  // EXPLOIT: pick best strategy by weighted score
  let bestStrategy: DifficultyStrategyName = "random";
  let bestScore = -1;

  for (const [name, stats] of Object.entries(strategies) as [DifficultyStrategyName, StrategyScore][]) {
    if (stats.trials === 0) continue;
    const score = stats.retention1d * 0.4 + stats.retention7d * 0.6;
    if (score > bestScore) {
      bestScore = score;
      bestStrategy = name;
    }
  }

  return bestStrategy;
}

// ─── Session word ordering ───────────────────────────

interface ScoredItem {
  item: SessionItem;
  difficulty: number; // 0-1, higher = harder
}

function getItemDifficulty(item: SessionItem): number {
  const wp = item.wordProgress;
  // Combine accuracy (inverted) and exercise level
  const accuracyDifficulty = 1 - (wp.accuracy || 0);
  const levelDifficulty = ((wp.exerciseLevel || 1) - 1) / 6; // normalize 1-7 to 0-1
  const isLeech = wp.isLeech ? 0.3 : 0;
  return Math.min(1, accuracyDifficulty * 0.5 + levelDifficulty * 0.3 + isLeech);
}

export function orderSessionWords(
  items: SessionItem[],
  strategy: DifficultyStrategyName
): SessionItem[] {
  if (items.length <= 1) return items;

  const scored: ScoredItem[] = items.map((item) => ({
    item,
    difficulty: getItemDifficulty(item),
  }));

  const easy = scored.filter((s) => s.difficulty <= 0.5);
  const hard = scored.filter((s) => s.difficulty > 0.5);

  switch (strategy) {
    case "wave":
      return interleaveWave(easy, hard);

    case "ascending": {
      const sorted = [...scored].sort((a, b) => a.difficulty - b.difficulty);
      // Last 20% = cooldown (easy words)
      const cooldownCount = Math.floor(sorted.length * 0.2);
      const main = sorted.slice(0, sorted.length - cooldownCount);
      const cooldown = sorted.slice(sorted.length - cooldownCount);
      shuffle(cooldown);
      return [...main, ...cooldown].map((s) => s.item);
    }

    case "descending":
      return [...scored]
        .sort((a, b) => b.difficulty - a.difficulty)
        .map((s) => s.item);

    case "random":
    default:
      shuffle(scored);
      return scored.map((s) => s.item);
  }
}

// ─── Helpers ─────────────────────────────────────────

function interleaveWave(easy: ScoredItem[], hard: ScoredItem[]): SessionItem[] {
  const result: SessionItem[] = [];
  const pattern = [3, 1, 2, 1]; // easy, hard, easy, hard, ...
  let eIdx = 0;
  let hIdx = 0;
  let pIdx = 0;

  shuffle(easy);
  shuffle(hard);

  while (eIdx < easy.length || hIdx < hard.length) {
    const count = pattern[pIdx % pattern.length];
    const isEasy = pIdx % 2 === 0;
    pIdx++;

    if (isEasy) {
      for (let i = 0; i < count && eIdx < easy.length; i++) {
        result.push(easy[eIdx++].item);
      }
    } else {
      for (let i = 0; i < count && hIdx < hard.length; i++) {
        result.push(hard[hIdx++].item);
      }
    }
  }

  // Append remaining
  while (eIdx < easy.length) result.push(easy[eIdx++].item);
  while (hIdx < hard.length) result.push(hard[hIdx++].item);

  return result;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Strategy score update ───────────────────────────

/**
 * Update strategy scores with new retention data.
 * Called after measuring retention 1d and 7d post-session.
 */
export function updateStrategyScore(
  currentScores: Record<DifficultyStrategyName, StrategyScore>,
  strategy: DifficultyStrategyName,
  retention1d: number,
  retention7d: number,
  alpha: number = 0.2
): Record<DifficultyStrategyName, StrategyScore> {
  const updated = { ...currentScores };
  const old = updated[strategy];

  updated[strategy] = {
    retention1d: old.trials === 0 ? retention1d : alpha * retention1d + (1 - alpha) * old.retention1d,
    retention7d: old.trials === 0 ? retention7d : alpha * retention7d + (1 - alpha) * old.retention7d,
    trials: old.trials + 1,
  };

  return updated;
}
