/**
 * Data Pipeline — event logging, batch saves, time helpers
 * FluentFlow v3.1 §2
 *
 * COMPATIBILITY: This is a NEW file. Does not modify any existing system.
 * Existing per-word saves in learn/page.tsx remain as fallback.
 * This pipeline adds batch saving + event logging on top.
 */
import { Timestamp, writeBatch, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ExerciseType, TrackDirection } from "@/lib/types";

// ─── Time Helpers (§1.1) ─────────────────────────────

const TIMEZONE = typeof window !== "undefined"
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "Europe/Warsaw";

export function getTimezone(): string {
  return TIMEZONE;
}

export function getTodayString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  // "2026-04-04" — ISO format in user's local timezone
}

export function getYesterdayString(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export function getDayOfWeek(): number {
  return new Date().getDay(); // 0=Sun, 6=Sat
}

export function getHourOfDay(): number {
  return new Date().getHours();
}

export function getWeekNumber(): number {
  const d = new Date();
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

// ─── Session Metadata (§1.3) ─────────────────────────

export interface SessionMetadata {
  sessionId: string;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  localDate: string;
  localStartHour: number;
  dayOfWeek: number;
  timezone: string;
}

export function createSessionMetadata(sessionId: string): SessionMetadata {
  return {
    sessionId,
    startedAt: Timestamp.now(),
    endedAt: null,
    localDate: getTodayString(),
    localStartHour: getHourOfDay(),
    dayOfWeek: getDayOfWeek(),
    timezone: TIMEZONE,
  };
}

// ─── Word Event (§2.2) ──────────────────────────────

export interface FsrsSnapshot {
  stability: number;
  difficulty: number;
  retrievability: number;
  nextReview: Timestamp | null;
  interval: number; // days until next review
}

export interface WordEvent {
  wordId: string;
  word: string;
  sessionId: string;
  positionInSession: number;

  // Time
  timestamp: Timestamp;
  localDate: string;
  localHour: number;
  dayOfWeek: number;
  responseTimeMs: number;

  // Exercise
  exerciseType: ExerciseType;
  exerciseLevel: number;
  direction: TrackDirection;

  // Result
  wasCorrect: boolean;
  finalRating: 1 | 2 | 3 | 4;
  reFlipUsed: boolean;

  // Session context at moment of answer
  fatigueScore: number;
  sessionAccuracySoFar: number;
  sessionDurationSoFar: number;
  consecutiveCorrectInSession: number;
  consecutiveWrongInSession: number;

  // FSRS before and after
  fsrsBefore: FsrsSnapshot;
  fsrsAfter: FsrsSnapshot;
}

// ─── Word Update Batch item (§2.4) ──────────────────

export interface WordUpdateBatch {
  wordId: string;
  track: TrackDirection;
  wasCorrect: boolean;
  // New FSRS values
  newStability: number;
  newDifficulty: number;
  newRetrievability: number;
  newNextReview: Timestamp;
  timestamp: Timestamp;
  // Escalation
  newExerciseLevel: number;
  newConsecutiveCorrect: number;
  newConsecutiveEasy: number;
  // Leech
  isLeech: boolean;
}

// ─── Build helpers ───────────────────────────────────

export function buildFsrsSnapshot(
  stability: number,
  difficulty: number,
  retrievability: number,
  nextReview: Timestamp | null
): FsrsSnapshot {
  const now = Date.now();
  const interval = nextReview
    ? Math.round((nextReview.toMillis() - now) / (24 * 60 * 60 * 1000))
    : 0;
  return { stability, difficulty, retrievability, nextReview, interval };
}

// ─── Batch Flush (§2.4) ─────────────────────────────

export async function flushBatch(
  uid: string,
  sessionId: string,
  pendingUpdates: WordUpdateBatch[],
  pendingEvents: WordEvent[]
): Promise<void> {
  if (pendingUpdates.length === 0 && pendingEvents.length === 0) return;

  try {
    const batch = writeBatch(db);

    // Word progress updates
    for (const update of pendingUpdates) {
      const ref = doc(db, "users", uid, "progress", update.wordId);
      batch.update(ref, {
        [`tracks.${update.track}.stability`]: update.newStability,
        [`tracks.${update.track}.difficulty`]: update.newDifficulty,
        [`tracks.${update.track}.nextReview`]: update.newNextReview,
        [`tracks.${update.track}.lastReview`]: update.timestamp,
        exerciseLevel: update.newExerciseLevel,
        consecutiveCorrect: update.newConsecutiveCorrect,
        consecutiveEasy: update.newConsecutiveEasy,
        isLeech: update.isLeech,
      });
    }

    // Word events to session subcollection
    for (const event of pendingEvents) {
      const ref = doc(collection(db, "users", uid, "sessions", sessionId, "events"));
      batch.set(ref, event);
    }

    await batch.commit();
  } catch (err) {
    console.error("[DataPipeline] flushBatch failed:", err);
    // Don't throw — individual saves from learn/page.tsx serve as fallback
  }
}

// ─── Pending buffer manager ─────────────────────────

const FLUSH_THRESHOLD = 5;

export class PendingBuffer {
  updates: WordUpdateBatch[] = [];
  events: WordEvent[] = [];
  private uid: string;
  private sessionId: string;

  constructor(uid: string, sessionId: string) {
    this.uid = uid;
    this.sessionId = sessionId;
  }

  add(update: WordUpdateBatch, event: WordEvent): void {
    this.updates.push(update);
    this.events.push(event);
  }

  shouldFlush(): boolean {
    return this.updates.length >= FLUSH_THRESHOLD;
  }

  async flush(): Promise<void> {
    if (this.updates.length === 0) return;
    const u = [...this.updates];
    const e = [...this.events];
    this.updates = [];
    this.events = [];
    await flushBatch(this.uid, this.sessionId, u, e);
  }

  get pendingCount(): number {
    return this.updates.length;
  }
}
