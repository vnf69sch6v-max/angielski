"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  AnalysisReport as AnalysisReportType,
  SupportingArgument,
  CounterArgument,
  CitationFragment,
} from "@/lib/types";

interface AnalysisReportProps {
  report: AnalysisReportType;
  isLoading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────

const relevanceBadge = {
  high: { label: "Wysoka", className: "bg-success-muted text-success" },
  medium: { label: "Średnia", className: "bg-warning-muted text-warning" },
  low: { label: "Niska", className: "bg-bg-surface-hover text-text-secondary" },
};

const riskBadge = {
  high: { label: "Wysokie ryzyko", className: "bg-error-muted text-error" },
  medium: { label: "Średnie ryzyko", className: "bg-warning-muted text-warning" },
  low: { label: "Niskie ryzyko", className: "bg-bg-surface-hover text-text-secondary" },
};

// ─── Section Wrapper ──────────────────────────────────

function Section({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4
          hover:bg-bg-surface-hover transition-colors duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <h3 className="font-heading text-lg text-text-primary">{title}</h3>
        </div>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 text-text-secondary shrink-0"
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
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Copy Toast ───────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body
        border border-border text-text-secondary
        hover:bg-bg-surface-hover hover:text-text-primary
        transition-colors duration-200 shrink-0"
    >
      {copied ? (
        <>
          <svg
            className="w-3.5 h-3.5 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
          <span className="text-success">Skopiowano</span>
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
            />
          </svg>
          Kopiuj
        </>
      )}
    </button>
  );
}

// ─── Supporting Argument Card ─────────────────────────

function SupportingArgumentCard({
  arg,
  index,
}: {
  arg: SupportingArgument;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-bg/50 border border-border rounded-xl p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-text-primary text-sm font-body leading-relaxed flex-1">
          {arg.thesis}
        </p>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-body font-medium shrink-0 ${relevanceBadge[arg.relevance].className}`}
        >
          {relevanceBadge[arg.relevance].label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        <span className="font-mono text-accent text-xs">{arg.caseNumber}</span>
        <span className="text-border text-xs">•</span>
        <span className="text-text-secondary text-xs font-body">{arg.court}</span>
        <span className="text-border text-xs">•</span>
        <span className="text-text-secondary text-xs font-body">{arg.date}</span>
      </div>
    </motion.div>
  );
}

// ─── Counter Argument Card ────────────────────────────

function CounterArgumentCard({
  arg,
  index,
}: {
  arg: CounterArgument;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-bg/50 border border-border rounded-xl p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-text-primary text-sm font-body leading-relaxed flex-1">
          {arg.thesis}
        </p>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-body font-medium shrink-0 ${riskBadge[arg.risk].className}`}
        >
          {riskBadge[arg.risk].label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        <span className="font-mono text-accent text-xs">{arg.caseNumber}</span>
        <span className="text-border text-xs">•</span>
        <span className="text-text-secondary text-xs font-body">{arg.court}</span>
        <span className="text-border text-xs">•</span>
        <span className="text-text-secondary text-xs font-body">{arg.date}</span>
      </div>
    </motion.div>
  );
}

// ─── Citation Block ───────────────────────────────────

function CitationBlock({
  citation,
  index,
}: {
  citation: CitationFragment;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-bg/50 border-l-2 border-l-accent border border-border rounded-xl p-4"
    >
      <blockquote className="text-text-primary text-sm font-body leading-relaxed italic mb-3">
        &ldquo;{citation.text}&rdquo;
      </blockquote>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-accent text-xs">
            {citation.caseNumber}
          </span>
          <span className="text-border text-xs">•</span>
          <span className="text-text-secondary text-xs font-body">
            {citation.court}
          </span>
          <span className="text-border text-xs">•</span>
          <span className="text-text-secondary text-xs font-body">
            {citation.date}
          </span>
        </div>
        <CopyButton text={`„${citation.text}" (${citation.caseNumber}, ${citation.court})`} />
      </div>
    </motion.div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-bg-surface-hover rounded-lg animate-pulse-soft ${className}`}
    />
  );
}

function LoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-bg-surface border border-border rounded-2xl backdrop-blur p-6 space-y-6"
    >
      {/* Summary skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-7 h-7 rounded" />
          <Skeleton className="w-40 h-6" />
        </div>
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>

      {/* Arguments skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-7 h-7 rounded" />
          <Skeleton className="w-52 h-6" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="w-full h-24" />
        ))}
      </div>

      {/* Counter arguments skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-7 h-7 rounded" />
          <Skeleton className="w-44 h-6" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="w-full h-24" />
        ))}
      </div>

      {/* Citations skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-7 h-7 rounded" />
          <Skeleton className="w-36 h-6" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="w-full h-20" />
        ))}
      </div>

      {/* Recommendation skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-7 h-7 rounded" />
          <Skeleton className="w-56 h-6" />
        </div>
        <Skeleton className="w-full h-28" />
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────

export default function AnalysisReport({
  report,
  isLoading = false,
}: AnalysisReportProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-bg-surface border border-border rounded-2xl backdrop-blur p-6 space-y-4"
    >
      {/* Title */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <svg
            className="w-4 h-4 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
        <h2 className="font-heading text-xl text-text-primary">
          Raport analizy
        </h2>
      </div>

      {/* 1. Summary */}
      <Section icon="📋" title="Podsumowanie">
        <p className="text-text-primary text-sm font-body leading-relaxed">
          {report.summary}
        </p>
      </Section>

      {/* 2. Supporting Arguments */}
      {report.supportingArguments.length > 0 && (
        <Section icon="✅" title="Argumenty wspierające">
          <div className="space-y-3">
            {report.supportingArguments.map((arg, i) => (
              <SupportingArgumentCard
                key={`${arg.caseNumber}-${i}`}
                arg={arg}
                index={i}
              />
            ))}
          </div>
        </Section>
      )}

      {/* 3. Counter Arguments */}
      {report.counterArguments.length > 0 && (
        <Section icon="⚠️" title="Kontrargumenty">
          <div className="space-y-3">
            {report.counterArguments.map((arg, i) => (
              <CounterArgumentCard
                key={`${arg.caseNumber}-${i}`}
                arg={arg}
                index={i}
              />
            ))}
          </div>
        </Section>
      )}

      {/* 4. Citations */}
      {report.citations.length > 0 && (
        <Section icon="📝" title="Gotowe cytaty">
          <div className="space-y-3">
            {report.citations.map((citation, i) => (
              <CitationBlock
                key={`${citation.caseNumber}-${i}`}
                citation={citation}
                index={i}
              />
            ))}
          </div>
        </Section>
      )}

      {/* 5. Recommendation */}
      <Section icon="🎯" title="Rekomendacja strategii">
        <div className="bg-accent-muted border border-accent/20 rounded-xl p-4">
          <p className="text-text-primary text-sm font-body leading-relaxed">
            {report.recommendation}
          </p>
        </div>
      </Section>
    </motion.div>
  );
}
