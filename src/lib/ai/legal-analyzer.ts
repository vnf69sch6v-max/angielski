"use client";

import { getGeminiModel } from "./gemini";
import {
  BriefAnalysis,
  AnalysisReport,
  SAOSJudgmentDetail,
  CourtType,
} from "@/lib/types";
import { cleanJudgmentText } from "@/lib/saos";

// ─── Helper: Parse JSON from Gemini response ─────────

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ─── Step 1: Extract Keywords from Brief ─────────────

export async function extractKeywords(
  briefText: string
): Promise<BriefAnalysis> {
  const model = getGeminiModel();

  const prompt = `Jesteś prawnikiem-analitykiem specjalizującym się w polskim prawie. Przeanalizuj poniższe pismo procesowe i wygeneruj słowa kluczowe oraz wysoce zoptymalizowane zapytania wyszukiwania dla bazy orzecznictwa sądowego SAOS, tak aby znaleźć wyroki idealnie pasujące do specyficznego kontekstu sprawy (zarówno pod kątem prawnym, jak i faktycznym).

PISMO PROCESOWE:
"""
${briefText.substring(0, 8000)}
"""

Wyodrębnij:
1. "keywords" — 5-10 pojedynczych, ogólnych pojęć prawnych i faktycznych występujących w piśmie (np. "zadośćuczynienie", "błąd medyczny", "operacja").
2. "searchQueries" — 3-4 wysoce zoptymalizowane zapytania wyszukiwania dla wyszukiwarki SAOS, uszeregowane od najbardziej precyzyjnego do ogólnego. 
   - Każde zapytanie powinno składać się z 2-4 słów/fraz kluczowych powiązanych ze sobą, które łącznie definiują unikalny kontekst tej sprawy (np. dla poślizgnięcia na lodzie: ["nieodśnieżony chodnik zadośćuczynienie", "poślizgnięcie na lodzie odpowiedzialność", "art 415 kc chodnik"]).
   - Unikaj zbyt długich zapytań (maksymalnie 4 słowa na zapytanie).
   - Unikaj słów pospolitych (jak "pozew", "pismo", "sprawa", "wniosek", "powód").
   - Dopasuj zapytanie bezpośrednio do kluczowych faktów sprawy (np. "zakażenie szpitalne gronkowcem", "wypowiedzenie umowy bez wypowiedzenia").
3. "legalBases" — wszystkie podstawy prawne wymienione w piśmie (np. "art. 415 k.c.", "art. 445 § 1 k.c."). Jeśli nie ma wprost — wywnioskuj z kontekstu.
4. "caseType" — typ sprawy po polsku (np. "cywilna", "karna", "administracyjna", "gospodarcza", "pracownicza")
5. "courtType" — typ sądu odpowiedni do wyszukiwania: "COMMON" (sądy powszechne), "SUPREME" (Sąd Najwyższy), "ADMINISTRATIVE" (sądy administracyjne), "CONSTITUTIONAL_TRIBUNAL", "NATIONAL_APPEAL_CHAMBER"
6. "summary" — 2-3 zdania streszczające istotę pisma i główne roszczenie/żądanie

Odpowiedz WYŁĄCZNIE prawidłowym JSON bez żadnego innego tekstu:
{
  "keywords": ["keyword1", "keyword2", ...],
  "searchQueries": ["phrase1 phrase2", "phrase3 phrase4", ...],
  "legalBases": ["art. X k.c.", ...],
  "caseType": "cywilna",
  "courtType": "COMMON",
  "summary": "Streszczenie pisma..."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const analysis = parseJsonResponse<BriefAnalysis>(text);

  // Validate
  if (!analysis.keywords || analysis.keywords.length === 0) {
    throw new Error("AI nie wyekstrahowało słów kluczowych z pisma");
  }
  if (!analysis.searchQueries || analysis.searchQueries.length === 0) {
    analysis.searchQueries = [analysis.keywords.slice(0, 3).join(" ")];
  }

  // Default courtType if invalid
  const validCourtTypes: CourtType[] = [
    "COMMON",
    "SUPREME",
    "ADMINISTRATIVE",
    "CONSTITUTIONAL_TRIBUNAL",
    "NATIONAL_APPEAL_CHAMBER",
  ];
  if (!validCourtTypes.includes(analysis.courtType)) {
    analysis.courtType = "COMMON";
  }

  return analysis;
}

// ─── Step 2: Analyze Judgments in Context ─────────────

export async function analyzeJudgments(
  briefText: string,
  briefAnalysis: BriefAnalysis,
  judgments: SAOSJudgmentDetail[]
): Promise<AnalysisReport> {
  const model = getGeminiModel();

  // Prepare judgment summaries for the prompt (limit to avoid token overflow)
  const judgmentSummaries = judgments.slice(0, 8).map((j, i) => {
    const caseNumber = j.courtCases?.[0]?.caseNumber || "brak sygnatury";
    const court = j.division?.court?.name || "nieznany sąd";
    const date = j.judgmentDate || "brak daty";
    const text = cleanJudgmentText(j.textContent || "").substring(0, 3000);

    return `--- WYROK ${i + 1} ---
Sygnatura: ${caseNumber}
Sąd: ${court}
Data: ${date}
Treść (fragment):
${text}`;
  });

  const prompt = `Jesteś doświadczonym prawnikiem-analitykiem. Twoim zadaniem jest dogłębna analiza wyroków sądowych w kontekście pisma procesowego klienta.

STRESZCZENIE PISMA PROCESOWEGO:
"""
${briefAnalysis.summary}
Główne roszczenie/argumentacja dotyczy: ${briefAnalysis.keywords.join(", ")}
Podstawy prawne: ${briefAnalysis.legalBases.join(", ")}
"""

TREŚĆ PISMA (fragment):
"""
${briefText.substring(0, 4000)}
"""

ZNALEZIONE WYROKI:
${judgmentSummaries.join("\n\n")}

Na podstawie powyższych wyroków, przygotuj szczegółowy raport analizy:

1. "summary" — ogólne podsumowanie analizy (3-5 zdań): jakie linie orzecznicze wynikają ze znalezionych wyroków, czy są spójne z argumentacją pisma
2. "supportingArguments" — tezy z wyroków WSPIERAJĄCE argumentację pisma. Dla każdej tezy podaj:
   - "thesis" — dokładna teza/fragment orzeczenia wspierający argumentację (cytuj lub parafrazuj)
   - "caseNumber" — sygnatura wyroku
   - "court" — nazwa sądu
   - "date" — data wyroku
   - "relevance" — "high" / "medium" / "low"
3. "counterArguments" — tezy z wyroków PRZECIWNE argumentacji pisma (mogą być użyte przez stronę przeciwną). Dla każdej:
   - "thesis" — teza/fragment
   - "caseNumber" — sygnatura
   - "court" — sąd
   - "date" — data
   - "risk" — "high" / "medium" / "low"
4. "citations" — gotowe fragmenty tekstowe do BEZPOŚREDNIEGO wklejenia do pisma procesowego, z prawidłowym powołaniem na orzecznictwo. Format: "Jak wskazał [sąd] w wyroku z dnia [data], sygn. akt [sygnatura], «[cytat/parafraza]»". Dla każdego:
   - "text" — gotowy fragment do wklejenia
   - "caseNumber" — sygnatura
   - "court" — sąd
   - "date" — data
5. "recommendation" — 3-5 zdań rekomendacji strategii procesowej na podstawie analizy orzecznictwa

Odpowiedz WYŁĄCZNIE prawidłowym JSON:
{
  "summary": "...",
  "supportingArguments": [...],
  "counterArguments": [...],
  "citations": [...],
  "recommendation": "..."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const report = parseJsonResponse<AnalysisReport>(text);

  // Validate basic structure
  if (!report.summary) {
    throw new Error("AI nie wygenerowało prawidłowego raportu analizy");
  }

  // Ensure arrays exist
  report.supportingArguments = report.supportingArguments || [];
  report.counterArguments = report.counterArguments || [];
  report.citations = report.citations || [];
  report.recommendation = report.recommendation || "";

  return report;
}
