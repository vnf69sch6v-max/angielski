/**
 * Domain Balancer — weights domains by inverse accuracy
 * Based on FluentFlow Algorithm Spec §4.4
 */
import { Domain, UserStats, WordProgress } from "@/lib/types";

const ALL_DOMAINS: Domain[] = ["finance", "legal", "smalltalk", "tech"];
const MIN_WEIGHT = 0.15; // §4.4: no domain below 15%
const MAX_WEIGHT = 0.40; // §4.4: no domain above 40%

// ─── Calculate domain weights (§4.4) ─────────────────

export function getDomainWeights(
  stats: UserStats | null,
  userWeights?: Record<Domain, number>
): Record<Domain, number> {
  // If user set custom weights, use those as base
  if (userWeights) {
    const total = Object.values(userWeights).reduce((s, v) => s + v, 0);
    if (total > 0) {
      const normalized: Record<Domain, number> = {} as Record<Domain, number>;
      for (const d of ALL_DOMAINS) {
        normalized[d] = userWeights[d] / total;
      }
      return clampAndNormalize(normalized);
    }
  }

  // No stats yet → equal distribution
  if (!stats) {
    return { finance: 0.25, legal: 0.25, smalltalk: 0.25, tech: 0.25 };
  }

  // §4.4: weight = 1 / accuracy (inverse — worse accuracy = higher weight)
  const rawWeights: Record<Domain, number> = {} as Record<Domain, number>;
  for (const domain of ALL_DOMAINS) {
    const accuracy = stats.accuracyByDomain[domain] || 0.5; // default 50% if no data
    rawWeights[domain] = 1 / Math.max(accuracy, 0.1); // prevent division by near-zero
  }

  // Normalize so all weights sum to 1.0
  const total = Object.values(rawWeights).reduce((s, v) => s + v, 0);
  const normalized: Record<Domain, number> = {} as Record<Domain, number>;
  for (const d of ALL_DOMAINS) {
    normalized[d] = rawWeights[d] / total;
  }

  return clampAndNormalize(normalized);
}

// ─── Pick words distributed by domain (§4.4) ────────

export function pickWordsForDomain(
  dueWords: WordProgress[],
  weights: Record<Domain, number>,
  count: number
): WordProgress[] {
  const result: WordProgress[] = [];
  const wordsByDomain: Record<Domain, WordProgress[]> = {
    finance: [], legal: [], smalltalk: [], tech: [],
  };

  // Group by domain
  for (const w of dueWords) {
    wordsByDomain[w.domain].push(w);
  }

  // Distribute count across domains
  const domainCounts: Record<Domain, number> = {} as Record<Domain, number>;
  let remaining = count;

  for (const d of ALL_DOMAINS) {
    domainCounts[d] = Math.round(count * weights[d]);
  }

  // Adjust rounding errors
  const totalAllocated = Object.values(domainCounts).reduce((s, v) => s + v, 0);
  if (totalAllocated !== count) {
    // Find domain with most available words and adjust
    const diff = count - totalAllocated;
    const sortedDomains = [...ALL_DOMAINS].sort(
      (a, b) => wordsByDomain[b].length - wordsByDomain[a].length
    );
    domainCounts[sortedDomains[0]] += diff;
  }

  // Pick words from each domain
  for (const d of ALL_DOMAINS) {
    const available = wordsByDomain[d];
    const toTake = Math.min(domainCounts[d], available.length);
    remaining -= toTake;

    // Words are already sorted by retrievability (from getDueWords)
    result.push(...available.slice(0, toTake));
  }

  // If some domains didn't have enough words, fill from others
  if (remaining > 0 && result.length < count) {
    const used = new Set(result.map((w) => w.wordId));
    const spillover = dueWords.filter((w) => !used.has(w.wordId));
    result.push(...spillover.slice(0, count - result.length));
  }

  return result;
}

// ─── Get domain with lowest accuracy (for new words) ─

export function getWeakestDomain(stats: UserStats | null): Domain {
  if (!stats) return "finance"; // default

  let weakest: Domain = "finance";
  let lowestAccuracy = Infinity;

  for (const d of ALL_DOMAINS) {
    const acc = stats.accuracyByDomain[d] || 0;
    if (acc < lowestAccuracy) {
      lowestAccuracy = acc;
      weakest = d;
    }
  }

  return weakest;
}

// ─── Helper: clamp weights to [0.15, 0.40] and re-normalize

function clampAndNormalize(weights: Record<Domain, number>): Record<Domain, number> {
  const clamped: Record<Domain, number> = {} as Record<Domain, number>;
  let needsRenormalize = false;

  for (const d of ALL_DOMAINS) {
    if (weights[d] < MIN_WEIGHT) {
      clamped[d] = MIN_WEIGHT;
      needsRenormalize = true;
    } else if (weights[d] > MAX_WEIGHT) {
      clamped[d] = MAX_WEIGHT;
      needsRenormalize = true;
    } else {
      clamped[d] = weights[d];
    }
  }

  if (needsRenormalize) {
    const total = Object.values(clamped).reduce((s, v) => s + v, 0);
    for (const d of ALL_DOMAINS) {
      clamped[d] = clamped[d] / total;
    }
  }

  return clamped;
}
