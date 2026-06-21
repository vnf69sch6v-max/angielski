import {
  SAOSSearchParams,
  SAOSSearchResponse,
  SAOSJudgmentDetail,
} from "./types";

const SAOS_API_BASE = "https://www.saos.org.pl/api";

// ─── Throttling ──────────────────────────────────────

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 500; // max 2 req/s

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

// ─── Search Judgments ────────────────────────────────

export async function searchJudgments(
  params: SAOSSearchParams
): Promise<SAOSSearchResponse> {
  await throttle();

  const url = new URL(`${SAOS_API_BASE}/search/judgments`);

  if (params.query) url.searchParams.set("all", params.query);
  if (params.courtType) url.searchParams.set("courtType", params.courtType);
  if (params.dateFrom) url.searchParams.set("judgmentDateFrom", params.dateFrom);
  if (params.dateTo) url.searchParams.set("judgmentDateTo", params.dateTo);
  if (params.keyword) url.searchParams.set("keyword", params.keyword);
  if (params.judgmentType) url.searchParams.set("judgmentType", params.judgmentType);
  url.searchParams.set("pageSize", String(params.pageSize || 20));
  url.searchParams.set("pageNumber", String(params.pageNumber || 0));
  url.searchParams.set("sortingField", "JUDGMENT_DATE");
  url.searchParams.set("sortingDirection", "DESC");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`SAOS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ─── Get Single Judgment ─────────────────────────────

export async function getJudgment(id: number): Promise<SAOSJudgmentDetail> {
  await throttle();

  const response = await fetch(`${SAOS_API_BASE}/judgments/${id}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`SAOS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ─── Helper: Extract text snippet ────────────────────

export function extractSnippet(
  textContent: string | undefined,
  maxLength: number = 300
): string {
  if (!textContent) return "";

  // Remove HTML tags
  const clean = textContent
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength).replace(/\s\S*$/, "") + "…";
}

// ─── Helper: Clean judgment text for AI ──────────────

export function cleanJudgmentText(textContent: string): string {
  return textContent
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
