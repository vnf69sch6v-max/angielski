import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  enableIndexedDbPersistence,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { UserProfile } from "./types";

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
