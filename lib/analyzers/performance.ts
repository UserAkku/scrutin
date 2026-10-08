/**
 * performance.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deep performance analyzer for Krillo.
 *
 * Strategy
 * ─────────
 * 1. Fetch Google PageSpeed Insights for BOTH mobile and desktop, requesting
 *    ALL four Lighthouse categories in a single call each so we have the full
 *    audit map available.
 * 2. Extract 20+ structured metrics from Lighthouse audits (Core Web Vitals,
 *    resource savings, third-party impact, DOM health, JS execution, etc.).
 * 3. Build a waterfall-like breakdown of the 10 heaviest network resources.
 * 4. Derive a composite score: mobile × 0.6 + desktop × 0.4 (mobile-first).
 * 5. Pass the rich telemetry to Gemini for expert issue cards; fall back to
 *    deterministic issues if the AI call fails.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { getPageSpeedApiKey } from "@/lib/env";
import { getGrade } from "@/lib/utils";
import type { CategoryResult, PerformanceMetric } from "@/types/audit";

// ─── Lighthouse API type definitions ──────────────────────────────────────────

/** A generic Lighthouse audit node. */
interface LighthouseAudit {
  id?: string;
  title?: string;
  description?: string;
  /** 0-1 score; null means "not applicable / informational". */
  score?: number | null;
  scoreDisplayMode?: "binary" | "numeric" | "informative" | "error" | "notApplicable" | "manual";
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
  details?: LighthouseAuditDetails;
  warnings?: string[];
}

/** Flexible container for audit detail tables, lists, etc. */
interface LighthouseAuditDetails {
  type?: string;
  /** Used by opportunity audits (e.g. unused-javascript). */
  overallSavingsMs?: number;
  overallSavingsBytes?: number;
  /** Row-based detail tables. */
  items?: LighthouseDetailItem[];
  /** Column headers for table-type details. */
  headings?: Array<{ key?: string; label?: string; valueType?: string }>;
  summary?: { wastedMs?: number; wastedBytes?: number };
}

/** One row inside a Lighthouse detail table (highly variable shape). */
interface LighthouseDetailItem {
  /* render-blocking-resources */
  url?: string;
  totalBytes?: number;
  wastedMs?: number;
  wastedBytes?: number;
  /* third-party-summary */
  entity?: string | { text?: string };
  blockingTime?: number;
  mainThreadTime?: number;
  transferSize?: number;
  /* dom-size */
  statistic?: string;
  value?: string | number;
  /* network-requests */
  resourceType?: string;
  mimeType?: string;
  startTime?: number;
  endTime?: number;
  responseCode?: number;
  /* bootup-time / mainthread-work-breakdown */
  group?: string;
  duration?: number;
  [key: string]: unknown;
}

/** Field-data (Chrome UX Report) metrics returned in loadingExperience. */
interface CruxMetric {
  percentile?: number;
  category?: "FAST" | "AVERAGE" | "SLOW";
  distributions?: Array<{ min?: number; max?: number; proportion?: number }>;
}

/** Category score object inside lighthouseResult.categories. */
interface LighthouseCategory {
  id?: string;
  title?: string;
  score?: number | null;
  auditRefs?: Array<{ id: string; weight?: number; group?: string }>;
}

/** Top-level PageSpeed Insights API v5 response. */
interface PageSpeedResponse {
  id?: string;
  kind?: string;
  lighthouseResult?: {
    requestedUrl?: string;
    finalUrl?: string;
    lighthouseVersion?: string;
    userAgent?: string;
    fetchTime?: string;
    environment?: { networkUserAgent?: string; hostUserAgent?: string; benchmarkIndex?: number };
    categories?: {
      performance?: LighthouseCategory;
      accessibility?: LighthouseCategory;
      "best-practices"?: LighthouseCategory;
      seo?: LighthouseCategory;
    };
    /** The full audit map – keyed by audit id. */
    audits?: Record<string, LighthouseAudit>;
    configSettings?: {
      emulatedFormFactor?: string;
      locale?: string;
      channel?: string;
    };
  };
  loadingExperience?: {
    id?: string;
    metrics?: {
      LARGEST_CONTENTFUL_PAINT_MS?: CruxMetric;
      FIRST_CONTENTFUL_PAINT_MS?: CruxMetric;
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: CruxMetric;
      INTERACTION_TO_NEXT_PAINT?: CruxMetric;
      FIRST_INPUT_DELAY_MS?: CruxMetric;
      EXPERIMENTAL_TIME_TO_FIRST_BYTE?: CruxMetric;
    };
    overall_category?: "FAST" | "AVERAGE" | "SLOW";
    origin_fallback?: boolean;
  };
  originLoadingExperience?: PageSpeedResponse["loadingExperience"];
}

// ─── Derived / output shapes ──────────────────────────────────────────────────

interface RenderBlockingResource {
  url: string;
  wastedMs: number;
  totalBytes: number;
}

interface ThirdPartyEntry {
  entity: string;
  blockingTime: number;
  mainThreadTime: number;
  transferSize: number;
}

interface WaterfallEntry {
  url: string;
  resourceType: string;
  transferSize: number;
  duration: number;
  responseCode: number;
}

interface MainThreadEntry {
  group: string;
  duration: number;
}

interface PerformanceData {
  /* Scores */
  mobileScore: number;
  desktopScore: number;
  compositeScore: number;

  /* Lighthouse category scores */
  mobileAccessibilityScore: number;
  mobileBestPracticesScore: number;
  mobileSeoScore: number;
  desktopAccessibilityScore: number;
  desktopBestPracticesScore: number;
  desktopSeoScore: number;

  /* Core Web Vitals + supplemental metrics (from Lighthouse lab data) */
  metrics: PerformanceMetric[];

  /* Field data (Chrome UX Report) */
  fieldData: {
    lcpCategory: string | null;
    fcpCategory: string | null;
    clsCategory: string | null;
    inpCategory: string | null;
    overallCategory: string | null;
    isOriginFallback: boolean;
  };

  /* Resource savings opportunities */
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savingsMs: number;
    savingsBytes: number;
  }>;

  /* Render-blocking resources */
  renderBlockingResources: RenderBlockingResource[];

  /* Unused JS / CSS savings */
  unusedJsSavingsBytes: number;
  unusedCssSavingsBytes: number;

  /* Image optimisation flags */
  usesOptimizedImages: boolean;
  usesNextGenFormats: boolean;
  usesTextCompression: boolean;
  efficientCachePolicy: boolean;

  /* Third-party impact */
  thirdPartySummary: ThirdPartyEntry[];

  /* Page weight */
  totalByteWeight: number;

  /* DOM health */
  domSize: number;

  /* JS execution */
  bootupTimeMs: number;

  /* Main-thread work breakdown */
  mainThreadWork: MainThreadEntry[];

  /* Network resource waterfall (top 10 heaviest) */
  waterfall: WaterfallEntry[];

  /* Passed diagnostic checks */
  diagnosticPassed: string[];

  /* Failed diagnostics (score < 0.9) */
  diagnosticFailed: Array<{ id: string; title: string; displayValue: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a CrUX metric into a normalised PerformanceMetric entry.
 */
function cruxToMetric(
  label: string,
  metric: CruxMetric | undefined,
  transform: (raw: number) => { value: number; displayValue: string }
): PerformanceMetric {
  const raw = metric?.percentile ?? 0;
  const category = metric?.category;
  const { value, displayValue } = transform(raw);
  return {
    label,
    value,
    displayValue,
    rating:
      category === "FAST"
        ? "good"
        : category === "AVERAGE"
          ? "needs-improvement"
          : "poor"
  };
}

/**
 * Convert a Lighthouse numeric audit into a PerformanceMetric with threshold-
 * based rating (thresholds in ms unless stated otherwise).
 */
function auditToMetric(
  label: string,
  audit: LighthouseAudit | undefined,
  goodThreshold: number,
  poorThreshold: number,
  formatter: (v: number) => string
): PerformanceMetric {
  const raw = audit?.numericValue ?? 0;
  const rating: PerformanceMetric["rating"] =
    raw <= goodThreshold ? "good" : raw <= poorThreshold ? "needs-improvement" : "poor";
  return { label, value: raw, displayValue: audit?.displayValue ?? formatter(raw), rating };
}

/** Round a raw lighthouse 0-1 score to a 0-100 integer. */
function lhScore(raw?: number | null): number {
  return Math.round((raw ?? 0) * 100);
}

/** Safely extract a string entity name from the variable third-party entity field. */
function entityName(entity: any): string {
  if (!entity) return "Unknown";
  if (typeof entity === "string") return entity;
  return entity.text ?? "Unknown";
}

// ─── PageSpeed API fetch ───────────────────────────────────────────────────────

/**
 * Hit the PageSpeed Insights v5 API for the given URL and strategy.
 * Requests ALL four Lighthouse categories to populate the full audit map.
 */
async function fetchPageSpeed(targetUrl: string, strategy: "mobile" | "desktop"): Promise<PageSpeedResponse> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", targetUrl);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", getPageSpeedApiKey());
  // Request all four categories so we get the full audit map.
  endpoint.searchParams.append("category", "performance");
  endpoint.searchParams.append("category", "accessibility");
  endpoint.searchParams.append("category", "best-practices");
  endpoint.searchParams.append("category", "seo");

  const response = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `PageSpeed API [${strategy}] responded with ${response.status}: ${body.slice(0, 200)}`
    );
  }
  return response.json() as Promise<PageSpeedResponse>;
}

// ─── Metric extraction ────────────────────────────────────────────────────────

/**
 * Pull all 20+ metrics out of a PageSpeed response pair and return the rich
 * PerformanceData object consumed by the return value and Gemini prompt.
 */
function extractPerformanceData(
  mobile: PageSpeedResponse,
  desktop: PageSpeedResponse
): PerformanceData {
  const mAudits = mobile.lighthouseResult?.audits ?? {};
  const dAudits = desktop.lighthouseResult?.audits ?? {};
  const mCats = mobile.lighthouseResult?.categories;
  const dCats = desktop.lighthouseResult?.categories;
  const mField = mobile.loadingExperience;
  const mFieldMetrics = mField?.metrics;

  // ── Scores ──────────────────────────────────────────────────────────────────
  const mobileScore = lhScore(mCats?.performance?.score);
  const desktopScore = lhScore(dCats?.performance?.score);
  const compositeScore = Math.round(mobileScore * 0.6 + desktopScore * 0.4);

  const mobileAccessibilityScore = lhScore(mCats?.accessibility?.score);
  const mobileBestPracticesScore = lhScore(mCats?.["best-practices"]?.score);
  const mobileSeoScore = lhScore(mCats?.seo?.score);
  const desktopAccessibilityScore = lhScore(dCats?.accessibility?.score);
  const desktopBestPracticesScore = lhScore(dCats?.["best-practices"]?.score);
  const desktopSeoScore = lhScore(dCats?.seo?.score);

  // ── Core Web Vitals (lab data from mobile Lighthouse) ───────────────────────
  const lcpMetric = auditToMetric(
    "LCP",
    mAudits["largest-contentful-paint"],
    2500,
    4000,
    (v) => `${(v / 1000).toFixed(2)} s`
  );
  const clsMetric = auditToMetric(
    "CLS",
    mAudits["cumulative-layout-shift"],
    0.1,
    0.25,
    (v) => v.toFixed(3)
  );
  const fcpMetric = auditToMetric(
    "FCP",
    mAudits["first-contentful-paint"],
    1800,
    3000,
    (v) => `${(v / 1000).toFixed(2)} s`
  );
  const tbtMetric = auditToMetric(
    "TBT",
    mAudits["total-blocking-time"],
    200,
    600,
    (v) => `${Math.round(v)} ms`
  );
  const siMetric = auditToMetric(
    "SI",
    mAudits["speed-index"],
    3400,
    5800,
    (v) => `${(v / 1000).toFixed(2)} s`
  );
  const ttiMetric = auditToMetric(
    "TTI",
    mAudits["interactive"],
    3800,
    7300,
    (v) => `${(v / 1000).toFixed(2)} s`
  );

  // ── Desktop CWV lab data ────────────────────────────────────────────────────
  const dLcpMetric = auditToMetric(
    "LCP (desktop)",
    dAudits["largest-contentful-paint"],
    2500,
    4000,
    (v) => `${(v / 1000).toFixed(2)} s`
  );
  const dTbtMetric = auditToMetric(
    "TBT (desktop)",
    dAudits["total-blocking-time"],
    200,
    600,
    (v) => `${Math.round(v)} ms`
  );

  // ── INP – from field data (CrUX) if available ───────────────────────────────
  const inpMetric = cruxToMetric(
    "INP",
    mFieldMetrics?.INTERACTION_TO_NEXT_PAINT,
    (raw) => ({
      value: raw,
      displayValue: `${raw} ms`
    })
  );
  // Override rating thresholds: good ≤ 200 ms, poor > 500 ms.
  const inpValue = mFieldMetrics?.INTERACTION_TO_NEXT_PAINT?.percentile ?? 0;
  const inpCorrectedRating: PerformanceMetric["rating"] =
    inpValue <= 200 ? "good" : inpValue <= 500 ? "needs-improvement" : "poor";

  // ── TTFB (field data) ───────────────────────────────────────────────────────
  const ttfbMetric = cruxToMetric(
    "TTFB",
    mFieldMetrics?.EXPERIMENTAL_TIME_TO_FIRST_BYTE,
    (raw) => ({ value: raw, displayValue: `${raw} ms` })
  );

  const metrics: PerformanceMetric[] = [
    lcpMetric,
    clsMetric,
    fcpMetric,
    tbtMetric,
    siMetric,
    ttiMetric,
    { ...inpMetric, rating: inpCorrectedRating },
    ttfbMetric,
    dLcpMetric,
    dTbtMetric
  ];

  // ── Field data summary ───────────────────────────────────────────────────────
  const fieldData: PerformanceData["fieldData"] = {
    lcpCategory: mFieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS?.category ?? null,
    fcpCategory: mFieldMetrics?.FIRST_CONTENTFUL_PAINT_MS?.category ?? null,
    clsCategory: mFieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category ?? null,
    inpCategory: mFieldMetrics?.INTERACTION_TO_NEXT_PAINT?.category ?? null,
    overallCategory: mField?.overall_category ?? null,
    isOriginFallback: mField?.origin_fallback ?? false
  };

  // ── Opportunities (audits that have savings) ─────────────────────────────────
  const opportunities = Object.values(mAudits)
    .filter(
      (a) =>
        a.score !== null &&
        typeof a.score === "number" &&
        a.score < 1 &&
        ((a.details?.overallSavingsMs ?? 0) > 0 || (a.details?.overallSavingsBytes ?? 0) > 0)
    )
    .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 10)
    .map((a) => ({
      id: a.id ?? "",
      title: a.title ?? "Optimization opportunity",
      description: a.description ?? "",
      savingsMs: a.details?.overallSavingsMs ?? 0,
      savingsBytes: a.details?.overallSavingsBytes ?? 0
    }));

  // ── Render-blocking resources ────────────────────────────────────────────────
  const renderBlockingAudit = mAudits["render-blocking-resources"];
  const renderBlockingResources: RenderBlockingResource[] = (
    renderBlockingAudit?.details?.items ?? []
  )
    .slice(0, 8)
    .map((item) => ({
      url: item.url ?? "",
      wastedMs: item.wastedMs ?? 0,
      totalBytes: item.totalBytes ?? 0
    }));

  // ── Unused JS / CSS ──────────────────────────────────────────────────────────
  const unusedJsSavingsBytes =
    mAudits["unused-javascript"]?.details?.overallSavingsBytes ??
    (mAudits["unused-javascript"]?.details?.items ?? []).reduce((s, i) => s + (i.wastedBytes ?? 0), 0);
  const unusedCssSavingsBytes =
    mAudits["unused-css-rules"]?.details?.overallSavingsBytes ??
    (mAudits["unused-css-rules"]?.details?.items ?? []).reduce((s, i) => s + (i.wastedBytes ?? 0), 0);

  // ── Image / compression / cache flags ───────────────────────────────────────
  const usesOptimizedImages = (mAudits["uses-optimized-images"]?.score ?? 0) >= 0.9;
  const usesNextGenFormats = (mAudits["uses-webp-images"]?.score ?? mAudits["uses-avif-images"]?.score ?? 0) >= 0.9;
  const usesTextCompression = (mAudits["uses-text-compression"]?.score ?? 0) >= 0.9;
  const efficientCachePolicy = (mAudits["uses-long-cache-ttl"]?.score ?? 0) >= 0.9;

  // ── Third-party summary (top 3 by blocking time) ─────────────────────────────
  const tpItems = mAudits["third-party-summary"]?.details?.items ?? [];
  const thirdPartySummary: ThirdPartyEntry[] = tpItems
    .sort((a, b) => (b.blockingTime ?? 0) - (a.blockingTime ?? 0))
    .slice(0, 3)
    .map((item) => ({
      entity: entityName(item.entity as ThirdPartyEntry["entity"]),
      blockingTime: item.blockingTime ?? 0,
      mainThreadTime: item.mainThreadTime ?? 0,
      transferSize: item.transferSize ?? 0
    }));

  // ── Total byte weight ────────────────────────────────────────────────────────
  const totalByteWeight = mAudits["total-byte-weight"]?.numericValue ?? 0;

  // ── DOM size ─────────────────────────────────────────────────────────────────
  // The first item in the dom-size table is typically the total count.
  const domSizeItems = mAudits["dom-size"]?.details?.items ?? [];
  const domSizeRaw =
    mAudits["dom-size"]?.numericValue ??
    (domSizeItems[0]?.value as number | undefined) ??
    0;
  const domSize = typeof domSizeRaw === "string" ? parseInt(domSizeRaw, 10) : Math.round(domSizeRaw);

  // ── JS bootup time ────────────────────────────────────────────────────────────
  const bootupTimeMs = mAudits["bootup-time"]?.numericValue ?? 0;

  // ── Main-thread work breakdown ────────────────────────────────────────────────
  const mainThreadWork: MainThreadEntry[] = (
    mAudits["mainthread-work-breakdown"]?.details?.items ?? []
  )
    .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
    .slice(0, 8)
    .map((item) => ({
      group: String(item.group ?? "Other"),
      duration: item.duration ?? 0
    }));

  // ── Network waterfall – top 10 heaviest resources ─────────────────────────────
  const networkItems = mAudits["network-requests"]?.details?.items ?? [];
  const waterfall: WaterfallEntry[] = networkItems
    .filter((item) => (item.transferSize ?? 0) > 0)
    .sort((a, b) => (b.transferSize ?? 0) - (a.transferSize ?? 0))
    .slice(0, 10)
    .map((item) => ({
      url: item.url ?? "",
      resourceType: item.resourceType ?? item.mimeType ?? "other",
      transferSize: item.transferSize ?? 0,
      duration: ((item.endTime ?? 0) - (item.startTime ?? 0)),
      responseCode: item.responseCode ?? 0
    }));

  // ── Passed diagnostic checks ──────────────────────────────────────────────────
  const diagnosticPassed = Object.values(mAudits)
    .filter((a) => a.score === 1 && a.scoreDisplayMode !== "notApplicable")
    .slice(0, 10)
    .map((a) => a.title ?? "Passed audit");

  // ── Failed diagnostic checks ──────────────────────────────────────────────────
  const diagnosticFailed = Object.values(mAudits)
    .filter(
      (a) =>
        typeof a.score === "number" &&
        a.score < 0.9 &&
        a.scoreDisplayMode !== "notApplicable" &&
        a.scoreDisplayMode !== "informative"
    )
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 12)
    .map((a) => ({
      id: a.id ?? "",
      title: a.title ?? "Diagnostic",
      displayValue: a.displayValue ?? ""
    }));

  return {
    mobileScore,
    desktopScore,
    compositeScore,
    mobileAccessibilityScore,
    mobileBestPracticesScore,
    mobileSeoScore,
    desktopAccessibilityScore,
    desktopBestPracticesScore,
    desktopSeoScore,
    metrics,
    fieldData,
    opportunities,
    renderBlockingResources,
    unusedJsSavingsBytes,
    unusedCssSavingsBytes,
    usesOptimizedImages,
    usesNextGenFormats,
    usesTextCompression,
    efficientCachePolicy,
    thirdPartySummary,
    totalByteWeight,
    domSize,
    bootupTimeMs,
    mainThreadWork,
    waterfall,
    diagnosticPassed,
    diagnosticFailed
  };
}

// ─── Gemini prompt builder ─────────────────────────────────────────────────────

function buildGeminiPrompt(url: string, d: PerformanceData): string {
  const byteKB = (b: number) => `${(b / 1024).toFixed(1)} KB`;
  const ms = (v: number) => `${Math.round(v)} ms`;

  return `You are a senior web performance engineer specialising in Core Web Vitals and Lighthouse audits.

Analyse the following PageSpeed Insights data for ${url} and return JSON with "summary" and "issues".

────────────────────────────────────────────────
SCORES
  Mobile performance    : ${d.mobileScore}/100
  Desktop performance   : ${d.desktopScore}/100
  Composite (60/40)     : ${d.compositeScore}/100
  Mobile accessibility  : ${d.mobileAccessibilityScore}/100
  Mobile best-practices : ${d.mobileBestPracticesScore}/100
  Mobile SEO            : ${d.mobileSeoScore}/100

CORE WEB VITALS (mobile lab data)
${d.metrics
  .map((m) => `  ${m.label.padEnd(18)}: ${m.displayValue.padEnd(12)} [${m.rating}]`)
  .join("\n")}

FIELD DATA (Chrome UX Report)
  LCP  field : ${d.fieldData.lcpCategory ?? "N/A"}
  FCP  field : ${d.fieldData.fcpCategory ?? "N/A"}
  CLS  field : ${d.fieldData.clsCategory ?? "N/A"}
  INP  field : ${d.fieldData.inpCategory ?? "N/A"}
  Overall    : ${d.fieldData.overallCategory ?? "N/A"}${d.fieldData.isOriginFallback ? " (origin-level fallback)" : ""}

TOP OPPORTUNITIES (sorted by potential time savings)
${d.opportunities
  .map((o) => `  • ${o.title}: save ${ms(o.savingsMs)} / ${byteKB(o.savingsBytes)}`)
  .join("\n") || "  None detected"}

RENDER-BLOCKING RESOURCES (${d.renderBlockingResources.length})
${d.renderBlockingResources
  .map((r) => `  • ${r.url}: ${ms(r.wastedMs)} wasted`)
  .join("\n") || "  None"}

RESOURCE SAVINGS
  Unused JS  : ${byteKB(d.unusedJsSavingsBytes)} transferable savings
  Unused CSS : ${byteKB(d.unusedCssSavingsBytes)} transferable savings

IMAGE / COMPRESSION
  Optimised images    : ${d.usesOptimizedImages ? "✓" : "✗"}
  Next-gen formats    : ${d.usesNextGenFormats ? "✓" : "✗"}
  Text compression    : ${d.usesTextCompression ? "✓" : "✗"}
  Efficient caching   : ${d.efficientCachePolicy ? "✓" : "✗"}

THIRD-PARTY IMPACT (top 3 by blocking time)
${d.thirdPartySummary
  .map(
    (tp) =>
      `  • ${tp.entity}: ${ms(tp.blockingTime)} blocking, ${ms(tp.mainThreadTime)} main-thread, ${byteKB(tp.transferSize)} transferred`
  )
  .join("\n") || "  None detected"}

PAGE WEIGHT & DOM HEALTH
  Total byte weight : ${byteKB(d.totalByteWeight)}
  DOM node count    : ${d.domSize}
  JS bootup time    : ${ms(d.bootupTimeMs)}

MAIN-THREAD WORK BREAKDOWN
${d.mainThreadWork.map((w) => `  • ${w.group}: ${ms(w.duration)}`).join("\n") || "  N/A"}

HEAVIEST RESOURCES (waterfall top 10)
${d.waterfall
  .map((w) => `  • [${w.resourceType}] ${w.url.slice(0, 80)}: ${byteKB(w.transferSize)} in ${ms(w.duration)}`)
  .join("\n") || "  N/A"}

FAILED DIAGNOSTICS
${d.diagnosticFailed.map((f) => `  • ${f.title}: ${f.displayValue}`).join("\n") || "  None"}
────────────────────────────────────────────────

Produce 5-10 specific, actionable issue cards. Prioritise by user-facing impact.
Each issue must include: title, description, fixSuggestion, severity (critical/medium/low), impact, effort.
Return JSON only.`;
}

// ─── Fallback issue builder ────────────────────────────────────────────────────

function buildFallbackIssues(d: PerformanceData) {
  const issues: Array<{
    title: string;
    description: string;
    fixSuggestion: string;
    severity: "critical" | "medium" | "low";
    impact: string;
    effort: string;
  }> = [];

  /* Render-blocking resources */
  if (d.renderBlockingResources.length > 0) {
    const total = d.renderBlockingResources.reduce((s, r) => s + r.wastedMs, 0);
    issues.push({
      title: `${d.renderBlockingResources.length} render-blocking resource(s) detected`,
      description: `${d.renderBlockingResources.map((r) => r.url).join(", ")} are delaying first paint by ~${Math.round(total)} ms.`,
      fixSuggestion:
        "Load stylesheets with media attributes, defer or async non-critical scripts, and inline critical CSS.",
      severity: total > 500 ? "critical" : "medium",
      impact: `Up to ${Math.round(total)} ms improvement in FCP / LCP.`,
      effort: "2-4 hours"
    });
  }

  /* Unused JavaScript */
  if (d.unusedJsSavingsBytes > 50 * 1024) {
    issues.push({
      title: "Significant unused JavaScript",
      description: `${(d.unusedJsSavingsBytes / 1024).toFixed(0)} KB of JavaScript is loaded but not executed during page load.`,
      fixSuggestion:
        "Implement code-splitting, lazy-load route-level bundles, and remove dead dependencies with bundle analysis tools like Webpack Bundle Analyzer.",
      severity: d.unusedJsSavingsBytes > 200 * 1024 ? "critical" : "medium",
      impact: `Reduces parse/compile time and TBT by up to ${(d.unusedJsSavingsBytes / 1024).toFixed(0)} KB transfer.`,
      effort: "4-8 hours"
    });
  }

  /* Unused CSS */
  if (d.unusedCssSavingsBytes > 20 * 1024) {
    issues.push({
      title: "Unused CSS rules inflating payload",
      description: `${(d.unusedCssSavingsBytes / 1024).toFixed(0)} KB of CSS is unused on first load.`,
      fixSuggestion:
        "Use PurgeCSS or UnCSS to tree-shake unused styles. Consider CSS Modules or Tailwind's JIT mode to only emit used utilities.",
      severity: "medium",
      impact: "Faster render-unblocking and reduced style recalculation.",
      effort: "2-4 hours"
    });
  }

  /* Next-gen image formats */
  if (!d.usesNextGenFormats) {
    issues.push({
      title: "Images not served in next-gen format",
      description: "PNG/JPEG assets could be converted to WebP or AVIF for superior compression.",
      fixSuggestion:
        "Use <picture> with WebP/AVIF sources plus JPEG/PNG fallbacks. In Next.js, enable the built-in Image component.",
      severity: "medium",
      impact: "20-35% reduction in image transfer size.",
      effort: "1-2 hours"
    });
  }

  /* Text compression */
  if (!d.usesTextCompression) {
    issues.push({
      title: "Text assets not compressed (Gzip/Brotli)",
      description: "JS, CSS, and HTML files are being served without HTTP compression.",
      fixSuggestion:
        "Enable Brotli (preferred) or Gzip on your server/CDN. In Next.js this is on by default; verify your hosting configuration.",
      severity: "medium",
      impact: "60-80% reduction in text asset transfer sizes.",
      effort: "30 minutes"
    });
  }

  /* Caching */
  if (!d.efficientCachePolicy) {
    issues.push({
      title: "Assets missing long cache TTLs",
      description: "Static assets are not leveraging browser caching efficiently.",
      fixSuggestion:
        "Set Cache-Control: max-age=31536000, immutable for versioned/hashed static assets. Use content hashes in filenames.",
      severity: "low",
      impact: "Repeat visitors load pages significantly faster.",
      effort: "1 hour"
    });
  }

  /* DOM size */
  if (d.domSize > 1500) {
    issues.push({
      title: `Excessive DOM size (${d.domSize} nodes)`,
      description: `The page contains ${d.domSize} DOM nodes. Google recommends fewer than 1,500.`,
      fixSuggestion:
        "Virtualise long lists, paginate content server-side, and audit for unnecessary wrapper elements.",
      severity: d.domSize > 3000 ? "critical" : "medium",
      impact: "Reduces style recalculation, layout, and painting time.",
      effort: "4-8 hours"
    });
  }

  /* JS bootup time */
  if (d.bootupTimeMs > 2000) {
    issues.push({
      title: `High JavaScript execution time (${Math.round(d.bootupTimeMs)} ms)`,
      description: "JavaScript is spending excessive time parsing, compiling, and executing on the main thread.",
      fixSuggestion:
        "Profile with Chrome DevTools, code-split large bundles, defer non-critical JS, and move heavy work to Web Workers.",
      severity: d.bootupTimeMs > 5000 ? "critical" : "medium",
      impact: "Directly reduces TBT and TTI.",
      effort: "4-12 hours"
    });
  }

  /* Third-party impact */
  const highImpactTp = d.thirdPartySummary.filter((tp) => tp.blockingTime > 150);
  if (highImpactTp.length > 0) {
    issues.push({
      title: "Third-party scripts blocking the main thread",
      description: `${highImpactTp.map((tp) => tp.entity).join(", ")} contribute significant main-thread blocking time.`,
      fixSuggestion:
        "Load analytics, chat widgets, and ad scripts with async/defer. Use Partytown to offload third-party scripts to a worker thread.",
      severity: "medium",
      impact: `Up to ${Math.round(highImpactTp.reduce((s, tp) => s + tp.blockingTime, 0))} ms TBT reduction.`,
      effort: "2-4 hours"
    });
  }

  /* Top opportunity from Lighthouse (fallback for when AI is off) */
  if (d.opportunities[0] && issues.length < 3) {
    const opp = d.opportunities[0];
    issues.push({
      title: opp.title,
      description: opp.description || "Lighthouse identified a top resource optimisation opportunity.",
      fixSuggestion: "Follow the Lighthouse recommendation in Chrome DevTools > Lighthouse panel.",
      severity: opp.savingsMs > 500 ? "critical" : "medium",
      impact: `~${Math.round(opp.savingsMs)} ms and ${(opp.savingsBytes / 1024).toFixed(0)} KB potential savings.`,
      effort: "30-90 minutes"
    });
  }

  return issues;
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Analyse the performance of `targetUrl` using Google PageSpeed Insights (v5).
 *
 * Fetches mobile + desktop Lighthouse results in parallel, extracts 20+
 * structured metrics, generates AI-powered issue cards via Gemini, and
 * returns a fully-typed CategoryResult.
 */
export async function analyzePerformance(targetUrl: string): Promise<CategoryResult> {
  // ── 1. Parallel PSI fetch (mobile + desktop) ─────────────────────────────────
  const [mobile, desktop] = await Promise.all([
    fetchPageSpeed(targetUrl, "mobile"),
    fetchPageSpeed(targetUrl, "desktop")
  ]);

  // ── 2. Extract all metrics ───────────────────────────────────────────────────
  const data = extractPerformanceData(mobile, desktop);

  // ── 3. AI-powered issue cards ────────────────────────────────────────────────
  type IssuePayload = {
    summary: string;
    issues: Array<{
      title: string;
      description: string;
      fixSuggestion: string;
      severity: "critical" | "medium" | "low";
      impact: string;
      effort: string;
    }>;
  };

  let aiResponse: IssuePayload | null = null;

  try {
    aiResponse = await generateJson<IssuePayload>(
      buildGeminiPrompt(targetUrl, data),
      [],
      defaultIssueSchema
    );
  } catch {
    // Gracefully fall through to deterministic fallback issues.
    aiResponse = null;
  }

  // ── 4. Issue normalisation ───────────────────────────────────────────────────
  const rawIssues = aiResponse?.issues ?? buildFallbackIssues(data);
  const issues = rawIssues.map((issue) => ({
    ...issue,
    category: "performance" as const
  }));

  // ── 5. Passed checks ─────────────────────────────────────────────────────────
  const passedChecks = [
    data.usesOptimizedImages ? "Optimised images" : "",
    data.usesNextGenFormats ? "Next-gen image formats (WebP/AVIF)" : "",
    data.usesTextCompression ? "Text compression enabled (Gzip/Brotli)" : "",
    data.efficientCachePolicy ? "Long-TTL cache policy in place" : "",
    data.renderBlockingResources.length === 0 ? "No render-blocking resources" : "",
    data.domSize > 0 && data.domSize <= 1500 ? `Healthy DOM size (${data.domSize} nodes)` : "",
    data.thirdPartySummary.every((tp) => tp.blockingTime <= 150)
      ? "Third-party scripts within acceptable blocking budget"
      : "",
    data.mobileScore >= 90 ? "Mobile Lighthouse score ≥ 90" : "",
    data.desktopScore >= 90 ? "Desktop Lighthouse score ≥ 90" : "",
    ...data.diagnosticPassed.slice(0, 5)
  ].filter(Boolean) as string[];

  // ── 6. Summary ───────────────────────────────────────────────────────────────
  const summaryText =
    aiResponse?.summary ??
    `Mobile Lighthouse performance scored ${data.mobileScore}/100 and desktop reached ${data.desktopScore}/100 ` +
      `(composite: ${data.compositeScore}/100). ` +
      `${data.opportunities.length > 0
        ? `Top opportunity: "${data.opportunities[0]?.title}" could save ~${Math.round(data.opportunities[0]?.savingsMs ?? 0)} ms.`
        : "No significant resource opportunities detected."
      }`;

  // ── 7. Assemble and return ───────────────────────────────────────────────────
  return {
    category: "performance",
    score: data.compositeScore,
    grade: getGrade(data.compositeScore),
    summary: summaryText,
    issues,
    passedChecks,
    data
  };
}
