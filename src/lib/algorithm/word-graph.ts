/**
 * Word Graph — semantic connections between words
 * Based on FluentFlow V3 §5
 * Built via Gemini API, stored in Firestore per domain.
 */
import { WordGraphEntry, WordConnection, Domain, RelationType, WordProgress } from "@/lib/types";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Firestore CRUD ──────────────────────────────────

export async function getWordGraph(
  userId: string,
  domain: Domain
): Promise<Map<string, WordGraphEntry>> {
  const ref = doc(db, "users", userId, "wordGraph", domain);
  const snap = await getDoc(ref);
  const map = new Map<string, WordGraphEntry>();
  if (snap.exists()) {
    const data = snap.data();
    const entries = (data.entries || []) as WordGraphEntry[];
    for (const entry of entries) {
      map.set(entry.wordId, entry);
    }
  }
  return map;
}

export async function saveWordGraph(
  userId: string,
  domain: Domain,
  entries: WordGraphEntry[]
): Promise<void> {
  const ref = doc(db, "users", userId, "wordGraph", domain);
  await setDoc(ref, { entries, updatedAt: new Date() });
}

// ─── Build connections lookup ────────────────────────

/**
 * Build a flat Map<wordId, Set<connectedWordId>> for quick lookup
 * in the recommendation engine.
 */
export function buildConnectionsMap(
  graphEntries: Map<string, WordGraphEntry>
): Map<string, Set<string>> {
  const connectionsMap = new Map<string, Set<string>>();

  Array.from(graphEntries.entries()).forEach(([wordId, entry]) => {
    const connections = new Set<string>();
    for (const conn of entry.connections) {
      connections.add(conn.wordId);
    }
    connectionsMap.set(wordId, connections);
  });

  return connectionsMap;
}

/**
 * Get connected words for a given wordId, sorted by strength descending.
 */
export function getConnectedWords(
  wordId: string,
  graph: Map<string, WordGraphEntry>,
  limit: number = 3
): WordConnection[] {
  const entry = graph.get(wordId);
  if (!entry) return [];
  return [...entry.connections]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

/**
 * Select words from the same cluster for matching exercises.
 * Returns wordIds in the same topic cluster as the given word.
 */
export function getClusterWords(
  wordId: string,
  graph: Map<string, WordGraphEntry>,
  allWords: WordProgress[],
  count: number = 5
): WordProgress[] {
  const entry = graph.get(wordId);
  if (!entry) return [];

  // Find same_topic or colocation connections
  const relatedIds = new Set<string>();
  for (const conn of entry.connections) {
    if (conn.relationType === "same_topic" || conn.relationType === "colocation") {
      relatedIds.add(conn.wordId);
    }
  }

  // Expand one level deeper for richer clusters
  for (const relId of Array.from(relatedIds)) {
    const relEntry = graph.get(relId);
    if (relEntry) {
      for (const conn of relEntry.connections) {
        if (conn.relationType === "same_topic") {
          relatedIds.add(conn.wordId);
        }
      }
    }
  }

  relatedIds.delete(wordId); // don't include self

  // Map to actual WordProgress objects
  const clusterWords = allWords.filter((w) => relatedIds.has(w.wordId));
  return clusterWords.slice(0, count);
}

// ─── Gemini prompt builder ───────────────────────────

/**
 * Build a prompt for Gemini to generate word connections.
 * Should be called once at seed time, then weekly for updates.
 */
export function buildWordGraphPrompt(words: { wordId: string; word: string }[], domain: string): string {
  const wordList = words.map((w) => w.word).join(", ");
  return `I have a list of English words from the domain "${domain}": [${wordList}].

For EACH word, identify connections with OTHER words on this list:
- synonyms (e.g. 'remedy' ↔ 'relief')
- antonyms (e.g. 'plaintiff' ↔ 'defendant')
- collocations (e.g. 'breach' + 'of contract')
- same_topic (e.g. 'jurisdiction', 'venue', 'court' = topic: courts)
- false_friends PL-EN (e.g. 'actual' ≠ 'aktualny')
- derivatives (e.g. 'liable' → 'liability')

Respond ONLY with valid JSON array. Max 5 connections per word. Skip words with no connections.
Format: [{"word": "...", "connections": [{"targetWord": "...", "relationType": "synonym|antonym|colocation|same_topic|false_friend|derivative", "strength": 0.8}]}]`;
}

/**
 * Parse Gemini response into WordGraphEntry objects.
 */
export function parseWordGraphResponse(
  response: string,
  wordIdMap: Map<string, string> // word -> wordId
): WordGraphEntry[] {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const entries: WordGraphEntry[] = [];

    for (const item of parsed) {
      const wordId = wordIdMap.get(item.word?.toLowerCase());
      if (!wordId) continue;

      const connections: WordConnection[] = [];
      for (const conn of item.connections || []) {
        const targetId = wordIdMap.get(conn.targetWord?.toLowerCase());
        if (!targetId) continue;
        connections.push({
          wordId: targetId,
          word: conn.targetWord,
          relationType: conn.relationType as RelationType,
          strength: conn.strength || 0.5,
        });
      }

      if (connections.length > 0) {
        entries.push({ wordId, word: item.word, connections });
      }
    }

    return entries;
  } catch (e) {
    console.error("[WordGraph] Failed to parse Gemini response:", e);
    return [];
  }
}
