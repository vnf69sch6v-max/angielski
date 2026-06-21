"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { SAOSJudgmentSummary } from "@/lib/types";

interface JudgmentCardProps {
  judgment: SAOSJudgmentSummary;
  onExpand?: (id: number) => void;
  isExpanded?: boolean;
  expandedContent?: string;
  relevanceTag?: "high" | "medium" | "low";
}

const judgmentTypeLabels: Record<string, string> = {
  SENTENCE: "Wyrok",
  DECISION: "Postanowienie",
  RESOLUTION: "Uchwała",
  REGULATION: "Zarządzenie",
  REASONS: "Uzasadnienie",
};

const courtTypeLabels: Record<string, string> = {
  COMMON: "Sąd powszechny",
  SUPREME: "Sąd Najwyższy",
  ADMINISTRATIVE: "Sąd administracyjny",
  CONSTITUTIONAL_TRIBUNAL: "Trybunał Konstytucyjny",
  NATIONAL_APPEAL_CHAMBER: "Krajowa Izba Odwoławcza",
};

const relevanceConfig = {
  high: {
    label: "Wysoka trafność",
    className: "bg-success-muted text-success",
  },
  medium: {
    label: "Średnia trafność",
    className: "bg-warning-muted text-warning",
  },
  low: {
    label: "Niska trafność",
    className: "bg-bg-surface-hover text-text-secondary",
  },
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function JudgmentCard({
  judgment,
  onExpand,
  isExpanded = false,
  expandedContent,
  relevanceTag,
}: JudgmentCardProps) {
  const caseNumber =
    judgment.courtCases?.[0]?.caseNumber ?? "Brak sygnatury";
  const courtName =
    judgment.division?.court?.name ??
    courtTypeLabels[judgment.courtType] ??
    judgment.courtType;
  const snippet =
    judgment.snippet ??
    judgment.textContent?.slice(0, 200) ??
    "Brak treści";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-bg-surface border border-border rounded-2xl backdrop-blur
        hover:border-accent/30 transition-colors duration-200 overflow-hidden"
    >
      {/* Main card content */}
      <button
        type="button"
        onClick={() => onExpand?.(judgment.id)}
        className="w-full text-left p-5 cursor-pointer"
        aria-expanded={isExpanded}
      >
        {/* Top row: case number + relevance tag */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="font-mono text-accent text-sm font-medium leading-tight">
            {caseNumber}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            {relevanceTag && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-body font-medium ${relevanceConfig[relevanceTag].className}`}
              >
                {relevanceConfig[relevanceTag].label}
              </span>
            )}

            {/* Chevron */}
            <motion.svg
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-4 h-4 text-text-secondary shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </motion.svg>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
          <span className="text-text-secondary text-xs font-body">
            {courtName}
          </span>
          <span className="text-border text-xs">•</span>
          <span className="text-text-secondary text-xs font-body">
            {formatDate(judgment.judgmentDate)}
          </span>
          <span className="text-border text-xs">•</span>
          <span className="text-text-secondary text-xs font-body">
            {judgmentTypeLabels[judgment.judgmentType] ??
              judgment.judgmentType}
          </span>
        </div>

        {/* Keywords */}
        {judgment.keywords && judgment.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {judgment.keywords.slice(0, 5).map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-md bg-accent-muted text-accent text-[11px] font-body"
              >
                {kw}
              </span>
            ))}
            {judgment.keywords.length > 5 && (
              <span className="px-2 py-0.5 text-text-secondary text-[11px] font-body">
                +{judgment.keywords.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Snippet */}
        <p className="text-text-secondary text-sm font-body leading-relaxed line-clamp-3">
          {snippet}
          {snippet.length >= 200 && "…"}
        </p>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 py-4">
              {expandedContent ? (
                <div
                  className="max-h-96 overflow-y-auto pr-2
                    text-text-primary text-sm font-body leading-relaxed
                    scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                >
                  <p className="whitespace-pre-wrap">{expandedContent}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-4">
                  <svg
                    className="w-4 h-4 animate-spin text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-text-secondary text-sm font-body">
                    Ładowanie pełnej treści wyroku...
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
