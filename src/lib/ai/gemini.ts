"use client";

import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { getApps } from "firebase/app";
import { QuizData, TranslationEval, Domain } from "@/lib/types";

// ─── Firebase AI (Gemini) Setup ──────────────────────

function getGeminiModel() {
  const app = getApps()[0];
  if (!app) throw new Error("Firebase not initialized");

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, { model: "gemini-2.0-flash" });
}

// ─── Helper: Parse JSON from Gemini response ─────────

function parseJsonResponse<T>(text: string): T {
  // Remove markdown code block wrapping if present
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ─── Rate Limiting ───────────────────────────────────

let callCount = 0;
const MAX_CALLS_PER_SESSION = 20;

export function resetCallCount() {
  callCount = 0;
}

export function canCallAI(): boolean {
  return callCount < MAX_CALLS_PER_SESSION;
}

// ─── Quiz Generation ─────────────────────────────────

export async function generateQuiz(
  word: string,
  translation: string,
  domain: Domain
): Promise<QuizData | null> {
  if (!canCallAI()) return null;

  try {
    callCount++;
    const model = getGeminiModel();

    const prompt = `You are an English teacher for a Polish B1 student studying ${domain}.
Generate a fill-in-the-blank quiz for the word "${word}" (Polish: "${translation}").

Create a natural English sentence with the word blanked out (use "___" for the blank).
Provide 4 options (1 correct = "${word}", 3 plausible distractors that are real English words but don't fit the context).
After the answer, explain in Polish (2 sentences max) why the correct answer fits.

Respond ONLY with valid JSON, no other text:
{ "sentence": "string with ___ for blank", "options": ["option1", "option2", "option3", "option4"], "correctIndex": 0, "explanationPL": "string in Polish" }

The correct answer "${word}" must be one of the options. correctIndex must point to it.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const quiz = parseJsonResponse<QuizData>(text);

    // Validate
    if (
      quiz.sentence &&
      quiz.options &&
      quiz.options.length === 4 &&
      typeof quiz.correctIndex === "number" &&
      quiz.correctIndex >= 0 &&
      quiz.correctIndex < 4 &&
      quiz.explanationPL
    ) {
      return quiz;
    }

    return null;
  } catch (error) {
    console.error("Failed to generate quiz:", error);
    return null;
  }
}

// ─── Translation Evaluation ──────────────────────────

export async function evaluateTranslation(
  polishSentence: string,
  userTranslation: string
): Promise<TranslationEval | null> {
  if (!canCallAI()) return null;

  try {
    callCount++;
    const model = getGeminiModel();

    const prompt = `You evaluate English translations by a Polish B1 student.
Original Polish: "${polishSentence}"
Student wrote: "${userTranslation}"

Be tolerant of minor typos and missing punctuation — these should NOT significantly lower the score.
Rate 0-100 for grammar, naturalness, and meaning accuracy.
Give brief Polish feedback (2-3 sentences).
Suggest 1-2 better alternatives if the translation isn't perfect.

Respond ONLY with valid JSON, no other text:
{ "score": number, "feedbackPL": "string in Polish", "alternatives": ["alt1", "alt2"] }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const evaluation = parseJsonResponse<TranslationEval>(text);

    // Validate
    if (
      typeof evaluation.score === "number" &&
      evaluation.score >= 0 &&
      evaluation.score <= 100 &&
      evaluation.feedbackPL
    ) {
      return evaluation;
    }

    return null;
  } catch (error) {
    console.error("Failed to evaluate translation:", error);
    return null;
  }
}

// ─── Example Sentences Generation ────────────────────

interface ExampleSentence {
  en: string;
  pl: string;
  level: string;
}

export async function generateExamples(
  word: string,
  domain: Domain
): Promise<ExampleSentence[] | null> {
  if (!canCallAI()) return null;

  try {
    callCount++;
    const model = getGeminiModel();

    const prompt = `Generate 3 example sentences using the English word "${word}" for a Polish B1 student.
- 1 simple sentence (B1 level)
- 1 intermediate sentence (B2 level)
- 1 domain-specific sentence (${domain} context)

Include Polish translation for each.

Respond ONLY with valid JSON, no other text:
{ "examples": [{ "en": "English sentence", "pl": "Polish translation", "level": "B1" }, ...] }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = parseJsonResponse<{ examples: ExampleSentence[] }>(text);

    if (data.examples && data.examples.length > 0) {
      return data.examples;
    }

    return null;
  } catch (error) {
    console.error("Failed to generate examples:", error);
    return null;
  }
}

// ─── Session Analysis ────────────────────────────────

interface SessionAnalysis {
  weakDomains: string[];
  sessionQuality: "poor" | "ok" | "good" | "excellent";
  suggestionPL: string;
  wordsNeedingMnemonics: string[];
}

export async function analyzeSession(sessionData: {
  accuracyOverall: number;
  accuracyByDomain: Record<string, number>;
  wrongWords: { word: string; exercise: string }[];
  duration: number;
  wordsReviewed: number;
}): Promise<SessionAnalysis | null> {
  if (!canCallAI()) return null;

  try {
    callCount++;
    const model = getGeminiModel();

    const prompt = `Analyze this English learning session for a Polish B1 student.

Session stats:
- Accuracy: ${Math.round(sessionData.accuracyOverall * 100)}%
- Words reviewed: ${sessionData.wordsReviewed}
- Duration: ${Math.round(sessionData.duration / 60000)} minutes
- Accuracy by domain: ${JSON.stringify(sessionData.accuracyByDomain)}
- Wrong words: ${sessionData.wrongWords.map(w => w.word).join(", ") || "none"}

Identify weak domains, assess session quality, and give a brief suggestion in Polish.
If any words were failed, flag them for mnemonic generation.

Respond ONLY with valid JSON, no other text:
{ "weakDomains": ["domain1"], "sessionQuality": "good", "suggestionPL": "string in Polish", "wordsNeedingMnemonics": ["word1"] }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<SessionAnalysis>(text);
  } catch (error) {
    console.error("Failed to analyze session:", error);
    return null;
  }
}

// ─── Mnemonic Generation ─────────────────────────────

export async function generateMnemonic(
  word: string,
  translation: string,
  timesWrong: number
): Promise<string | null> {
  if (!canCallAI()) return null;

  try {
    callCount++;
    const model = getGeminiModel();

    const prompt = `You help a Polish student remember English words.
The word "${word}" means "${translation}" in Polish.
The student has gotten it wrong ${timesWrong} times.

Create a SHORT mnemonic in Polish (1-2 sentences max).
Use phonetic similarity to Polish words, vivid imagery, or humor.

Respond with ONLY the mnemonic text, nothing else.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Failed to generate mnemonic:", error);
    return null;
  }
}

// ─── Weekly Report Generation (§7.4) ─────────────────

interface WeeklyReport {
  summaryPL: string;
  strengthsPL: string[];
  weaknessesPL: string[];
  recommendationPL: string;
  weeklyGoal: {
    newWordsTarget: number;
    reviewAccuracyTarget: number;
    focusDomain: string;
    streakTarget: number;
  };
  newWords: {
    word: string;
    translation: string;
    partOfSpeech: string;
    level: string;
    domain: string;
    tags: string[];
  }[];
}

export async function generateWeeklyReport(weekData: {
  totalSessions: number;
  totalWordsReviewed: number;
  averageAccuracy: number;
  accuracyByDomain: Record<string, number>;
  newWordsLearned: number;
  masteredWords: number;
  streakDays: number;
  weakestDomain: string;
  knownWords: string[];
}): Promise<WeeklyReport | null> {
  try {
    const model = getGeminiModel();

    const prompt = `Generate a weekly learning report in Polish for an English B1 student.

Weekly stats:
- Sessions: ${weekData.totalSessions}
- Words reviewed: ${weekData.totalWordsReviewed}
- Average accuracy: ${Math.round(weekData.averageAccuracy * 100)}%
- Accuracy by domain: ${JSON.stringify(weekData.accuracyByDomain)}
- New words learned: ${weekData.newWordsLearned}
- Words mastered: ${weekData.masteredWords}
- Streak: ${weekData.streakDays} days
- Weakest domain: ${weekData.weakestDomain}

Include:
1. Summary of the week (Polish)
2. Strengths (Polish, 2-3 items)
3. Weaknesses (Polish, 2-3 items)
4. Specific recommendation for next week (Polish)
5. Weekly goal (newWordsTarget, reviewAccuracyTarget, focusDomain, streakTarget)
6. Generate 10-15 new vocabulary words for the weakest domain (${weekData.weakestDomain}) at B2 level. Do NOT include words the student already knows: ${weekData.knownWords.slice(0, 50).join(", ")}.

Respond ONLY with valid JSON:
{
  "summaryPL": "string",
  "strengthsPL": ["string"],
  "weaknessesPL": ["string"],
  "recommendationPL": "string",
  "weeklyGoal": { "newWordsTarget": number, "reviewAccuracyTarget": number, "focusDomain": "string", "streakTarget": number },
  "newWords": [{ "word": "string", "translation": "string", "partOfSpeech": "string", "level": "B2", "domain": "${weekData.weakestDomain}", "tags": ["tag1"] }]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<WeeklyReport>(text);
  } catch (error) {
    console.error("Failed to generate weekly report:", error);
    return null;
  }
}
