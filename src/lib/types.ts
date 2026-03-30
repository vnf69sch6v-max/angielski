import { Timestamp } from "firebase/firestore";

// ─── Core Enums ───────────────────────────────────────

export type Domain = "finance" | "legal" | "smalltalk" | "tech";
export type WordState = "new" | "learning" | "review" | "relearning" | "mastered";
export type ExerciseLevel = 1 | 2 | 3 | 4; // flashcard / matching / quiz / translation
export type ExerciseType = "flashcard" | "matching" | "quiz" | "translation";

// ─── Domain Metadata ──────────────────────────────────

export const DOMAIN_CONFIG: Record<Domain, { label: string; labelPL: string; color: string }> = {
  finance: { label: "Finance", labelPL: "Finanse", color: "#3B82F6" },
  legal: { label: "Legal", labelPL: "Prawo", color: "#8B5CF6" },
  smalltalk: { label: "Small Talk", labelPL: "Rozmowa", color: "#F97316" },
  tech: { label: "Tech", labelPL: "Technologia", color: "#06B6D4" },
};

export const EXERCISE_TYPE_MAP: Record<ExerciseLevel, ExerciseType> = {
  1: "flashcard",
  2: "matching",
  3: "quiz",
  4: "translation",
};

export const MASTERY_LABELS: Record<WordState, { label: string; color: string }> = {
  new: { label: "Nowe", color: "#A1A1AA" },
  learning: { label: "W nauce", color: "#F59E0B" },
  review: { label: "Powtórka", color: "#3B82F6" },
  relearning: { label: "Ponowna nauka", color: "#EF4444" },
  mastered: { label: "Opanowane", color: "#22C55E" },
};

// ─── Word Data (from seed JSON) ───────────────────────

export interface SeedWord {
  word: string;
  translation: string;
  partOfSpeech: string;
  level: "B1" | "B2" | "C1";
  frequency: number; // 1-10
  tags: string[];
}

export interface WordList {
  domain: Domain;
  words: SeedWord[];
}

// ─── Word Progress (Firestore) ────────────────────────

export interface WordProgress {
  wordId: string;
  word: string;
  translation: string;
  domain: Domain;
  level: "B1" | "B2" | "C1";
  partOfSpeech: string;
  source: "seed" | "ai" | "manual";
  state: WordState;
  // FSRS fields (Phase 2 will populate these properly)
  stability: number;
  difficulty: number;
  retrievability: number;
  nextReview: Timestamp;
  lastReview: Timestamp | null;
  learningStep: number;
  // Exercise escalation
  exerciseLevel: ExerciseLevel;
  consecutiveCorrect: number;
  // Stats
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  averageResponseTime: number;
  timesWrongTotal: number;
  // AI cache
  exampleSentences: string[];
  mnemonic: string | null;
  quizCache: QuizData | null;
  // Dates
  dateAdded: Timestamp;
  dateFirstCorrect: Timestamp | null;
  dateMastered: Timestamp | null;
}

// ─── Quiz Data ────────────────────────────────────────

export interface QuizData {
  sentence: string;
  options: string[];
  correctIndex: number;
  explanationPL: string;
}

// ─── Translation Evaluation ──────────────────────────

export interface TranslationEval {
  score: number;
  feedbackPL: string;
  alternatives: string[];
}

// ─── Session ──────────────────────────────────────────

export interface Session {
  sessionId: string;
  date: Timestamp;
  durationMs: number;
  wordsReviewed: number;
  newWordsIntroduced: number;
  accuracyOverall: number;
  accuracyByDomain: Record<Domain, number>;
  wrongWords: { wordId: string; word: string; exercise: ExerciseType }[];
  exerciseBreakdown: Record<ExerciseType, number>;
  aiAnalysis: {
    weakDomains: string[];
    sessionQuality: string;
    suggestions: string;
  } | null;
}

// ─── User Profile ─────────────────────────────────────

export interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string | null;
  streakDays: number;
  lastSessionDate: Timestamp | null;
  settings: UserSettings;
  createdAt: Timestamp;
}

export interface UserSettings {
  domainWeights: Record<Domain, number>;
  dailyGoal: number; // new words per day (3-10)
  targetRetention: number; // 0.95 default
}

export const DEFAULT_SETTINGS: UserSettings = {
  domainWeights: {
    finance: 0.25,
    legal: 0.25,
    smalltalk: 0.25,
    tech: 0.25,
  },
  dailyGoal: 7,
  targetRetention: 0.95,
};

// ─── User Stats ───────────────────────────────────────

export interface UserStats {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  reviewWords: number;
  accuracyByDomain: Record<Domain, number>;
  streakDays: number;
  weeklyProgress: WeeklyDataPoint[];
  totalSessions: number;
  totalStudyTimeMs: number;
}

export interface WeeklyDataPoint {
  date: string; // ISO date string
  wordsReviewed: number;
  accuracy: number;
}

// ─── Session Item (for learn page) ───────────────────

export interface SessionItem {
  wordProgress: WordProgress;
  exerciseType: ExerciseType;
}

// ─── Answer Result ───────────────────────────────────

export interface AnswerResult {
  wordId: string;
  exerciseType: ExerciseType;
  wasCorrect: boolean;
  rawRating: number; // 1-4
  responseTimeMs: number;
}
