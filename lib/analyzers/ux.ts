import { fetchImageAsInlinePart, generateJson } from "@/lib/gemini";
import { scoreFromIssueDensity } from "@/lib/scoring";
import { getGrade } from "@/lib/utils";
import type { CategoryResult } from "@/types/audit";
import { fetchHtmlSnapshot, fetchJson } from "@/lib/analyzers/shared";

interface MicrolinkResponse {
  data?: {
    screenshot?: {
      url?: string;
    };
  };
}

export async function analyzeUx(targetUrl: string): Promise<CategoryResult> {
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  let screenshotUrl = "";
  try {
    const microlink = await fetchJson<MicrolinkResponse>(
      `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url`
    );
    screenshotUrl = microlink.data?.screenshot?.url ?? "";
  } catch {
    screenshotUrl = "";
  }

  const imagePart = screenshotUrl ? await fetchImageAsInlinePart(screenshotUrl) : undefined;

  let response:
    | {
        summary: string;
        issues: Array<{
          title: string;
          description: string;
          fixSuggestion: string;
          severity: "critical" | "medium" | "low";
          impact: string;
          effort: string;
        }>;
        wins: string[];
      }
    | null = null;

  try {
    response = await generateJson<{
      summary: string;
      issues: Array<{
        title: string;
        description: string;
        fixSuggestion: string;
        severity: "critical" | "medium" | "low";
        impact: string;
        effort: string;
      }>;
      wins: string[];
    }>(
      `You are a senior UX/UI designer and CRO specialist. Analyze this website screenshot and HTML.
Return JSON with "summary", "issues", and "wins".
HTML excerpt: ${snapshot.html.slice(0, 10000)}`,
      imagePart ? [imagePart] : []
    );
  } catch {
    response = null;
  }

  const fallbackIssues = [
    {
      title: "Manual UX review recommended",
      description:
        "The structural site snapshot was captured, but automated visual interpretation was limited for this run.",
      fixSuggestion:
        "Re-run the audit or review hero clarity, CTA prominence, typography contrast, and mobile spacing manually.",
      severity: "low" as const,
      impact: "Automated UX detail is incomplete.",
      effort: "10 minutes"
    }
  ];

  const issues = (response?.issues ?? fallbackIssues).map((issue) => ({
    ...issue,
    category: "ux" as const
  }));
  const score = scoreFromIssueDensity(issues.length, 14, 7, 4, issues);

  return {
    category: "ux",
    score,
    grade: getGrade(score),
    summary:
      response?.summary ??
      "UX audit completed with structural checks; advanced visual interpretation was partially unavailable.",
    issues,
    passedChecks: response?.wins ?? [],
    data: {
      screenshotUrl,
      htmlLength: snapshot.html.length
    }
  };
}
