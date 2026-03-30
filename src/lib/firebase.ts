import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  enableIndexedDbPersistence,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  WordProgress,
  UserProfile,
  UserStats,
  Session,
  DEFAULT_SETTINGS,
  Domain,
  SeedWord,
} from "./types";

// ─── Firebase Config ──────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);
const isBrowser = typeof window !== "undefined";

const app = isFirebaseConfigured && isBrowser
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0]
  : null;

export const db = app ? getFirestore(app) : (null as unknown as ReturnType<typeof getFirestore>);
export const auth = app ? getAuth(app) : (null as unknown as ReturnType<typeof getAuth>);
export const googleProvider = new GoogleAuthProvider();
export { isFirebaseConfigured };

// Enable offline persistence (only in browser, only if configured)
if (typeof window !== "undefined" && app && db) {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Firestore offline persistence failed:", err.code);
  });
}

// ─── User Profile ─────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, "users", uid, "profile", "data");
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
}

export async function createUserProfile(
  uid: string,
  displayName: string,
  email: string,
  photoURL: string | null
): Promise<UserProfile> {
  const profile: UserProfile = {
    displayName,
    email,
    photoURL,
    streakDays: 0,
    lastSessionDate: null,
    settings: DEFAULT_SETTINGS,
    createdAt: Timestamp.now(),
  };
  await setDoc(doc(db, "users", uid, "profile", "data"), profile);
  return profile;
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "profile", "data"), data);
}

// ─── User Stats ───────────────────────────────────────

export async function getUserStats(uid: string): Promise<UserStats | null> {
  const docRef = doc(db, "users", uid, "stats", "data");
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as UserStats) : null;
}

export async function updateUserStats(
  uid: string,
  data: Partial<UserStats>
): Promise<void> {
  await setDoc(doc(db, "users", uid, "stats", "data"), data, { merge: true });
}

// ─── Word Progress ────────────────────────────────────

export async function getWordProgress(
  uid: string,
  wordId: string
): Promise<WordProgress | null> {
  const docRef = doc(db, "users", uid, "progress", wordId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as WordProgress) : null;
}

export async function getAllWordProgress(uid: string): Promise<WordProgress[]> {
  const colRef = collection(db, "users", uid, "progress");
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((d) => d.data() as WordProgress);
}

export async function getWordsByState(
  uid: string,
  state: string
): Promise<WordProgress[]> {
  const colRef = collection(db, "users", uid, "progress");
  const q = query(colRef, where("state", "==", state));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as WordProgress);
}

export async function getDueWords(uid: string): Promise<WordProgress[]> {
  const colRef = collection(db, "users", uid, "progress");
  const q = query(
    colRef,
    where("nextReview", "<=", Timestamp.now()),
    where("state", "in", ["review", "relearning", "learning"])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as WordProgress);
}

export async function updateWordProgress(
  uid: string,
  wordId: string,
  data: Partial<WordProgress>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "progress", wordId), data);
}

export async function setWordProgress(
  uid: string,
  wordProgress: WordProgress
): Promise<void> {
  await setDoc(
    doc(db, "users", uid, "progress", wordProgress.wordId),
    wordProgress
  );
}

export async function deleteWordProgress(
  uid: string,
  wordId: string
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "progress", wordId));
}

// ─── Seed Words ───────────────────────────────────────

export function createWordProgressFromSeed(
  word: SeedWord,
  domain: Domain
): WordProgress {
  const wordId = `${domain}_${word.word.toLowerCase().replace(/\s+/g, "_")}`;
  return {
    wordId,
    word: word.word,
    translation: word.translation,
    domain,
    level: word.level,
    partOfSpeech: word.partOfSpeech,
    source: "seed",
    state: "new",
    stability: 0,
    difficulty: 0,
    retrievability: 0,
    nextReview: Timestamp.now(),
    lastReview: null,
    learningStep: 0,
    exerciseLevel: 1,
    consecutiveCorrect: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    accuracy: 0,
    averageResponseTime: 0,
    timesWrongTotal: 0,
    exampleSentences: [],
    mnemonic: null,
    quizCache: null,
    dateAdded: Timestamp.now(),
    dateFirstCorrect: null,
    dateMastered: null,
  };
}

export async function seedWordsForUser(
  uid: string,
  words: SeedWord[],
  domain: Domain
): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;

  for (const word of words) {
    const wp = createWordProgressFromSeed(word, domain);
    const docRef = doc(db, "users", uid, "progress", wp.wordId);
    batch.set(docRef, wp, { merge: true });
    count++;
  }

  await batch.commit();
  return count;
}

// ─── Sessions ─────────────────────────────────────────

export async function saveSession(
  uid: string,
  session: Session
): Promise<void> {
  await setDoc(
    doc(db, "users", uid, "sessions", session.sessionId),
    session
  );
}

export async function getRecentSessions(
  uid: string,
  count: number = 7
): Promise<Session[]> {
  const colRef = collection(db, "users", uid, "sessions");
  const q = query(colRef, orderBy("date", "desc"), limit(count));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as Session);
}

export async function getAllSessions(uid: string): Promise<Session[]> {
  const colRef = collection(db, "users", uid, "sessions");
  const q = query(colRef, orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as Session);
}

// ─── Helpers ──────────────────────────────────────────

export function generateId(): string {
  return doc(collection(db, "_")).id;
}

export async function resetAllProgress(uid: string): Promise<void> {
  const colRef = collection(db, "users", uid, "progress");
  const snapshot = await getDocs(colRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  // Reset stats
  await setDoc(doc(db, "users", uid, "stats", "data"), {
    totalWords: 0,
    masteredWords: 0,
    learningWords: 0,
    reviewWords: 0,
    accuracyByDomain: { finance: 0, legal: 0, smalltalk: 0, tech: 0 },
    streakDays: 0,
    weeklyProgress: [],
    totalSessions: 0,
    totalStudyTimeMs: 0,
  });

  // Reset streak
  await updateDoc(doc(db, "users", uid, "profile", "data"), {
    streakDays: 0,
    lastSessionDate: null,
  });
}
