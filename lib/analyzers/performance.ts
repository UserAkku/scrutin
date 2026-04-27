import { generateJson } from "@/lib/gemini";
import { getPageSpeedApiKey } from "@/lib/env";
import { getGrade } from "@/lib/utils";
import type { CategoryResult, PerformanceMetric } from "@/types/audit";

interface PageSpeedAudit {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  details?: {
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
  };
  displayValue?: string;
}

interface LighthouseResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
    };
    audits?: Record<string, PageSpeedAudit>;
  };
  loadingExperience?: {
    metrics?: Record<
      string,
      {
        percentile?: number;
        category?: "FAST" | "AVERAGE" | "SLOW";
      }
    >;
  };
}

function scoreMetric(metric?: { percentile?: number; category?: "FAST" | "AVERAGE" | "SLOW" }, unit = "ms") {
  const raw = metric?.percentile ?? 0;
  const value = unit === "s" ? raw / 1000 : raw;
  return {
    value,
    displayValue: unit === "ms" ? `${raw} ms` : `${(raw / 1000).toFixed(2)} s`,
    rating:
      metric?.category === "FAST"
        ? "good"
        : metric?.category === "AVERAGE"
          ? "needs-improvement"
          : "poor"
  } as const;
}

async function fetchPageSpeed(targetUrl: string, strategy: "mobile" | "desktop") {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", targetUrl);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", getPageSpeedApiKey());
  endpoint.searchParams.set("category", "performance");

  const response = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`PageSpeed ${strategy} failed (${response.status})`);
  }
  return response.json() as Promise<LighthouseResponse>;
}

export async function analyzePerformance(targetUrl: string): Promise<CategoryResult> {
  const [mobile, desktop] = await Promise.all([
    fetchPageSpeed(targetUrl, "mobile"),
    fetchPageSpeed(targetUrl, "desktop")
  ]);

  const mobileScore = Math.round(
    ((mobile.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
  );
  const desktopScore = Math.round(
    ((desktop.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
  );

  const metrics: PerformanceMetric[] = [
    {
      label: "LCP",
      ...scoreMetric(mobile.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS),
      displayValue: `${((mobile.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? 0) / 1000).toFixed(2)} s`
    },
    {
      label: "CLS",
      value: (mobile.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? 0) / 100,
      displayValue: `${((mobile.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? 0) / 100).toFixed(2)}`,
      rating:
        mobile.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category === "FAST"
          ? "good"
          : mobile.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category === "AVERAGE"
            ? "needs-improvement"
            : "poor"
    },
    {
      label: "FCP",
      ...scoreMetric(mobile.loadingExperience?.metrics?.FIRST_CONTENTFUL_PAINT_MS, "s"),
      displayValue: `${((mobile.loadingExperience?.metrics?.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? 0) / 1000).toFixed(2)} s`
    }
  ];

  const audits = mobile.lighthouseResult?.audits ?? {};
  const opportunities = Object.values(audits)
    .filter((audit) => (audit.details?.overallSavingsMs ?? 0) > 0 || (audit.details?.overallSavingsBytes ?? 0) > 0)
    .slice(0, 5)
    .map((audit) => ({
      title: audit.title ?? "Optimization opportunity",
      description: audit.description ?? "",
      savingsMs: audit.details?.overallSavingsMs ?? 0,
      savingsBytes: audit.details?.overallSavingsBytes ?? 0
    }));

  const diagnostics = Object.values(audits)
    .filter((audit) => typeof audit.score === "number" && audit.score < 0.9)
    .slice(0, 5)
    .map((audit) => ({
      title: audit.title ?? "Diagnostic",
      description: audit.description ?? ""
    }));

  const passedChecks = Object.values(audits)
    .filter((audit) => audit.score === 1)
    .slice(0, 8)
    .map((audit) => audit.title ?? "Passed audit");

  let suggestions:
    | {
        issues: Array<{
          title: string;
          description: string;
          fixSuggestion: string;
          severity: "critical" | "medium" | "low";
          impact: string;
          effort: string;
        }>;
      }
    | null = null;

  try {
    suggestions = await generateJson<{
      issues: Array<{
        title: string;
        description: string;
        fixSuggestion: string;
        severity: "critical" | "medium" | "low";
        impact: string;
        effort: string;
      }>;
    }>(
      `You are a senior web performance engineer. Convert these PageSpeed performance findings into concise issue cards.
Return JSON with an "issues" array only.
Performance score mobile: ${mobileScore}
Performance score desktop: ${desktopScore}
Opportunities: ${JSON.stringify(opportunities)}
Diagnostics: ${JSON.stringify(diagnostics)}`
    );
  } catch {
    suggestions = null;
  }

  const fallbackIssues = opportunities.slice(0, 3).map((item) => ({
    category: "performance" as const,
    severity: item.savingsMs > 500 ? "critical" as const : "medium" as const,
    title: item.title,
    description: item.description || "This PageSpeed opportunity is affecting load performance.",
    fixSuggestion:
      "Apply the Lighthouse recommendation, then re-test both mobile and desktop performance to confirm the savings.",
    impact: `${item.savingsMs} ms potential savings`,
    effort: "30-90 minutes"
  }));

  const issues = (suggestions?.issues ?? fallbackIssues).map((issue) => ({
    ...issue,
    category: "performance" as const
  }));

  const score = Math.round((mobileScore * 0.65) + (desktopScore * 0.35));
  return {
    category: "performance",
    score,
    grade: getGrade(score),
    summary: `Mobile performance landed at ${mobileScore}/100 and desktop reached ${desktopScore}/100.`,
    issues,
    passedChecks,
    data: {
      mobileScore,
      desktopScore,
      metrics,
      opportunities,
      diagnostics
    }
  };
}
