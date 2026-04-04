/**
 * Algorithm Intelligence Metrics — measuring how smart the algorithm is
 * FluentFlow v3.1 §4.2-4.3
 *
 * Calculates retention, efficiency, strategy performance, personalization quality.
 * Stored in users/{uid}/algorithmMetrics (one document).
 */
import { Domain, DifficultyStrategyName, WordProgress } from "@/lib/types";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getLearnerProfile } from "./learner-profile";

// ─── Types ───────────────────────────────────────────

export interface AlgorithmIntelligenceMetrics {
  // Retention
  retention1d: number;
  retention7d: number;
  retention1dTrend: number;
  retention7dTrend: number;

  // Enjoyment
  enjoymentScore: number;
  enjoymentTrend: number;

  // Efficiency
  wordsPerMinute: number;
  wordsToMastery: number;
  escalationSpeed: number;

  // Strategy
  bestStrategy: string;
  bestStrategyRetention: number;
  worstStrategyRetention: number;
  strategyTrials: number;

  // Personalization
  optimalTimeOfDay: number | null;
  optimalSessionLength: number | null;
  strongestDomain: Domain;
  weakestDomain: Domain;
  productionGap: number;

  // Meta
  dataPoints: number;
  weeksOfData: number;
  lastUpdated: Timestamp;
}

// ─── Firestore CRUD ──────────────────────────────────

export async function getIntelligenceMetrics(
  userId: string
): Promise<AlgorithmIntelligenceMetrics | null> {
  const ref = doc(db, "users", userId, "algorithmMetrics", "current");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as AlgorithmIntelligenceMetrics;
  }
  return null;
}

export async function saveIntelligenceMetrics(
  userId: string,
  metrics: AlgorithmIntelligenceMetrics
): Promise<void> {
  const ref = doc(db, "users", userId, "algorithmMetrics", "current");
  await setDoc(ref, metrics);
}

// ─── Calculate metrics ──────────────────────────────

export async function calculateIntelligenceMetrics(
  userId: string,
  allWords: WordProgress[],
  lastEnjoymentScore: number
): Promise<AlgorithmIntelligenceMetrics> {
  const profile = await getLearnerProfile(userId);
  const oldMetrics = await getIntelligenceMetrics(userId);

  // Retention from learner profile
  const retention1d = profile.avgRetentionRate1d || 0;
  const retention7d = profile.avgRetentionRate7d || 0;
  const retention1dTrend = oldMetrics ? retention1d - oldMetrics.retention1d : 0;
  const retention7dTrend = oldMetrics ? retention7d - oldMetrics.retention7d : 0;

  // Enjoyment
  const enjoymentScore = lastEnjoymentScore;
  const enjoymentTrend = oldMetrics ? enjoymentScore - oldMetrics.enjoymentScore : 0;

  // Efficiency
  const reviewedWords = allWords.filter((w) => w.totalAttempts > 0);
  const totalAttempts = reviewedWords.reduce((sum, w) => sum + w.totalAttempts, 0);
  const masteredWords = allWords.filter((w) => w.state === "mastered");
  const wordsPerMinute = totalAttempts > 0 ? reviewedWords.length / (totalAttempts * 0.1) : 0;
  const wordsToMastery = masteredWords.length > 0
    ? masteredWords.reduce((sum, w) => sum + w.totalAttempts, 0) / masteredWords.length
    : 0;

  // Escalation speed: average exerciseLevel for words with 10+ attempts
  const experiencedWords = allWords.filter((w) => w.totalAttempts >= 10);
  const escalationSpeed = experiencedWords.length > 0
    ? experiencedWords.reduce((sum, w) => sum + w.exerciseLevel, 0) / experiencedWords.length
    : 1;

  // Strategy from bandit
  const strategyScores = profile.difficultyStrategy?.strategyScores;
  let bestStrategy: DifficultyStrategyName = "random";
  let bestRet = 0;
  let worstRet = 1;
  let totalTrials = 0;

  if (strategyScores) {
    for (const [name, stats] of Object.entries(strategyScores) as [DifficultyStrategyName, { retention7d: number; trials: number }][]) {
      totalTrials += stats.trials;
      const ret = stats.retention7d;
      if (stats.trials > 0 && ret > bestRet) {
        bestRet = ret;
        bestStrategy = name;
      }
      if (stats.trials > 0 && ret < worstRet) {
        worstRet = ret;
      }
    }
  }

  // Personalization
  const domains: Domain[] = ["finance", "legal", "smalltalk", "tech"];
  let strongestDomain: Domain = "finance";
  let weakestDomain: Domain = "finance";
  let bestAcc = 0;
  let worstAcc = 1;

  for (const d of domains) {
    const acc = profile.domainStrength?.[d]?.accuracy || 0;
    if (acc > bestAcc) { bestAcc = acc; strongestDomain = d; }
    if (acc < worstAcc) { worstAcc = acc; weakestDomain = d; }
  }

  // Production gap
  const wordsWithTracks = allWords.filter((w) => w.tracks);
  const productionGap = wordsWithTracks.length > 0
    ? wordsWithTracks.reduce((sum, w) => {
        if (!w.tracks) return sum;
        return sum + (w.tracks.recognition.accuracy - w.tracks.production.accuracy);
      }, 0) / wordsWithTracks.length
    : 0;

  // Meta
  const dataPoints = totalAttempts;
  const firstWord = allWords.reduce((earliest, w) => {
    if (!earliest || (w.dateAdded && w.dateAdded.toMillis() < earliest.toMillis())) {
      return w.dateAdded;
    }
    return earliest;
  }, null as Timestamp | null);

  const weeksOfData = firstWord
    ? Math.floor((Date.now() - firstWord.toMillis()) / (7 * 24 * 60 * 60 * 1000))
    : 0;

  const metrics: AlgorithmIntelligenceMetrics = {
    retention1d,
    retention7d,
    retention1dTrend,
    retention7dTrend,
    enjoymentScore,
    enjoymentTrend,
    wordsPerMinute,
    wordsToMastery,
    escalationSpeed,
    bestStrategy,
    bestStrategyRetention: bestRet,
    worstStrategyRetention: worstRet,
    strategyTrials: totalTrials,
    optimalTimeOfDay: profile.optimalTimeOfDay,
    optimalSessionLength: profile.optimalSessionLength,
    strongestDomain,
    weakestDomain,
    productionGap,
    dataPoints,
    weeksOfData,
    lastUpdated: Timestamp.now(),
  };

  await saveIntelligenceMetrics(userId, metrics);
  return metrics;
}
