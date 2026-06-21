import { Timestamp } from "firebase/firestore";

// ─── User Profile ─────────────────────────────────────

export interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: Timestamp;
}

// ─── SAOS API Types ───────────────────────────────────

export type CourtType =
  | "COMMON"
  | "SUPREME"
  | "ADMINISTRATIVE"
  | "CONSTITUTIONAL_TRIBUNAL"
  | "NATIONAL_APPEAL_CHAMBER";

export type JudgmentType =
  | "SENTENCE"
  | "DECISION"
  | "RESOLUTION"
  | "REGULATION"
  | "REASONS";

export interface SAOSSearchParams {
  query: string;
  courtType?: CourtType;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  keyword?: string;
  judgmentType?: JudgmentType;
  pageSize?: number;  // 10-100, default 20
  pageNumber?: number; // 0-based
}

export interface SAOSCourtCase {
  caseNumber: string;
}

export interface SAOSCourt {
  id: number;
  code?: string;
  name: string;
  type?: string;
}

export interface SAOSDivision {
  id: number;
  name: string;
  court: SAOSCourt;
}

export interface SAOSJudgmentSummary {
  id: number;
  courtType: CourtType;
  courtCases: SAOSCourtCase[];
  judgmentType: JudgmentType;
  judgmentDate: string;
  division?: SAOSDivision;
  textContent?: string;
  keywords?: string[];
  // Enriched fields from search
  snippet?: string;
}

export interface SAOSJudgmentDetail extends SAOSJudgmentSummary {
  textContent: string;
  judges?: { name: string; function?: string; specialRoles?: string[] }[];
  courtReporters?: string[];
  legalBases?: string[];
  referencedRegulations?: {
    journalTitle: string;
    journalNo: number;
    journalYear: number;
    journalEntry: number;
    text: string;
  }[];
  source?: {
    code: string;
    judgmentUrl?: string;
  };
}

export interface SAOSSearchResponse {
  items: SAOSJudgmentSummary[];
  info: {
    totalCount: number;
  };
  links: { rel: string; href: string }[];
}

// ─── AI Analysis Types ────────────────────────────────

export interface BriefAnalysis {
  keywords: string[];
  searchQueries: string[];
  legalBases: string[];
  caseType: string;
  courtType: CourtType;
  summary: string;
}

export interface SupportingArgument {
  thesis: string;
  caseNumber: string;
  court: string;
  date: string;
  relevance: "high" | "medium" | "low";
}

export interface CounterArgument {
  thesis: string;
  caseNumber: string;
  court: string;
  date: string;
  risk: "high" | "medium" | "low";
}

export interface CitationFragment {
  text: string;
  caseNumber: string;
  court: string;
  date: string;
}

export interface AnalysisReport {
  summary: string;
  supportingArguments: SupportingArgument[];
  counterArguments: CounterArgument[];
  citations: CitationFragment[];
  recommendation: string;
}

// ─── App State Types ──────────────────────────────────

export type AnalysisStep =
  | "idle"
  | "extracting_keywords"
  | "searching_saos"
  | "fetching_judgments"
  | "analyzing"
  | "done"
  | "error";

export interface AnalysisState {
  step: AnalysisStep;
  briefText: string;
  briefAnalysis: BriefAnalysis | null;
  judgments: SAOSJudgmentDetail[];
  searchResults: SAOSJudgmentSummary[];
  totalResults: number;
  report: AnalysisReport | null;
  error: string | null;
}
