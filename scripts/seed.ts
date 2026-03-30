/**
 * Seed Script — loads wordlists from JSON into Firestore
 * Run: npx tsx scripts/seed.ts
 * 
 * Prerequisites: Firebase Auth — you must be logged in first via the app.
 * This script reads the UID from command line args or uses a default.
 */
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp, collection, getDocs } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// ─── Firebase Config (same as .env.local) ────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("❌ Missing Firebase config. Make sure .env.local is loaded.");
  console.error("   Run with: npx dotenv -e .env.local -- npx tsx scripts/seed.ts <UID>");
  process.exit(1);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ─── Types ───────────────────────────────────────────

interface SeedWord {
  word: string;
  translation: string;
  partOfSpeech: string;
  level: "B1" | "B2" | "C1";
  frequency: number;
  tags: string[];
}

interface WordList {
  domain: string;
  words: SeedWord[];
}

// ─── Main ────────────────────────────────────────────

async function seed(uid: string) {
  console.log(`\n🌱 Seeding words for user: ${uid}\n`);

  const wordlistDir = path.join(__dirname, "..", "src", "data", "wordlists");
  const files = ["finance.json", "legal.json", "smalltalk.json", "tech.json"];

  let totalSeeded = 0;
  let totalSkipped = 0;

  // Check existing words
  const existingRef = collection(db, `users/${uid}/progress`);
  const existingSnap = await getDocs(existingRef);
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  console.log(`📊 Found ${existingIds.size} existing words in Firestore\n`);

  for (const file of files) {
    const filePath = path.join(wordlistDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${file}, skipping`);
      continue;
    }

    const data: WordList = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const domain = data.domain;
    console.log(`📁 ${file}: ${data.words.length} words (${domain})`);

    let domainSeeded = 0;
    let domainSkipped = 0;

    for (const word of data.words) {
      const wordId = `${domain}_${word.word.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      if (existingIds.has(wordId)) {
        domainSkipped++;
        continue;
      }

      const wordProgress = {
        wordId,
        word: word.word,
        translation: word.translation,
        domain,
        level: word.level,
        partOfSpeech: word.partOfSpeech,
        source: "seed",
        state: "new",
        // FSRS defaults
        stability: 0,
        difficulty: 0,
        retrievability: 0,
        nextReview: Timestamp.now(),
        lastReview: null,
        learningStep: 0,
        // Exercise
        exerciseLevel: 1,
        consecutiveCorrect: 0,
        // Stats
        totalAttempts: 0,
        correctAttempts: 0,
        accuracy: 0,
        averageResponseTime: 0,
        timesWrongTotal: 0,
        // AI cache
        exampleSentences: [],
        mnemonic: null,
        quizCache: null,
        // Dates
        dateAdded: Timestamp.now(),
        dateFirstCorrect: null,
        dateMastered: null,
      };

      try {
        await setDoc(doc(db, `users/${uid}/progress`, wordId), wordProgress);
        domainSeeded++;
      } catch (err) {
        console.error(`  ❌ Failed to seed "${word.word}":`, err);
      }
    }

    console.log(`   ✅ Seeded: ${domainSeeded}, Skipped: ${domainSkipped}`);
    totalSeeded += domainSeeded;
    totalSkipped += domainSkipped;
  }

  // Create initial stats document
  const statsDoc = {
    totalWords: totalSeeded + existingIds.size,
    masteredWords: 0,
    learningWords: 0,
    reviewWords: 0,
    accuracyByDomain: {
      finance: 0,
      legal: 0,
      smalltalk: 0,
      tech: 0,
    },
    streakDays: 0,
    weeklyProgress: [],
    totalSessions: 0,
    totalStudyTimeMs: 0,
  };

  await setDoc(doc(db, `users/${uid}/stats`, "current"), statsDoc, { merge: true });

  console.log(`\n✨ Done! Total seeded: ${totalSeeded}, Skipped: ${totalSkipped}`);
  console.log(`📊 Total words in database: ${totalSeeded + existingIds.size}\n`);
}

// ─── CLI Entry ───────────────────────────────────────

const uid = process.argv[2];

if (!uid) {
  console.error("Usage: npx dotenv -e .env.local -- npx tsx scripts/seed.ts <USER_UID>");
  console.error("\nTo find your UID:");
  console.error("1. Log in to the app");
  console.error("2. Open browser console");
  console.error("3. Run: firebase.auth().currentUser.uid");
  process.exit(1);
}

seed(uid).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
