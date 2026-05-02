import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { getGrade } from "@/lib/utils";
import type { AuditIssue, CategoryResult } from "@/types/audit";
import { fetchHtmlSnapshot } from "@/lib/analyzers/shared";
import type { SecurityModuleResult } from "./types";

import { runHeadersModule } from "./headers";
import { runTlsModule } from "./tls";
import { runSecretsModule } from "./secrets";
import { runExposureModule } from "./exposure";
import { runDnsModule } from "./dns";
import { runCorsModule } from "./cors";
import { runClientSideModule } from "./client-side";
import { runFormsModule } from "./forms";
import { runCmsModule } from "./cms";
import { runReconModule } from "./recon";
import { runPrivacyModule } from "./privacy";

/** Weight per category (sums to 100) */
const CATEGORY_WEIGHTS: Record<string, number> = {
  headers:    15,
  tls:        15,
  secrets:    20,
  exposure:   15,
  dns:         8,
  cors:        7,
  clientSide:  8,
  forms:       4,
  cms:         3,
  recon:       3,
  privacy:     2,
};

/** Apply severity-based caps to a category sub-score */
function applyScoreCaps(score: number, issues: SecurityModuleResult["issues"]): number {
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "critical" || i.severity === "medium").length;

  let capped = score;
  if (criticalCount > 0) capped = Math.min(capped, 40);
  if (highCount >= 3) capped = Math.min(capped, 60);
  return capped;
}

/** Deduplicate issues by normalized title */
function deduplicateIssues(issues: AuditIssue[]): AuditIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = issue.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Safely run a module — if it throws, return a graceful info-level result */
async function safeRunModule(
  name: string,
  fn: () => Promise<SecurityModuleResult>
): Promise<SecurityModuleResult> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      moduleName: name,
      issues: [
        {
          title: `${name} module encountered an error`,
          description: `The ${name} security check could not complete: ${message}`,
          fixSuggestion: "Re-run the audit. If this persists, the target may be blocking automated analysis.",
          severity: "low" as const,
          impact: `${name} analysis was skipped.`,
          effort: "N/A",
        },
      ],
      passedChecks: [],
      score: 50, // neutral score for failed modules
      data: { error: message },
    };
  }
}

export async function analyzeSecurity(targetUrl: string): Promise<CategoryResult> {
  // Fetch HTML snapshot once and share across all modules
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  const { headers, root, url, html, isHeadersFromProxy } = snapshot;
  const hostname = new URL(url).hostname;
  const origin = new URL(url).origin;

  // Run ALL 11 modules in parallel
  const moduleResults = await Promise.allSettled([
    safeRunModule("headers",    () => runHeadersModule(headers, isHeadersFromProxy)),
    safeRunModule("tls",        () => runTlsModule(url, hostname, html, root)),
    safeRunModule("secrets",    () => runSecretsModule(html, root, url)),
    safeRunModule("exposure",   () => runExposureModule(origin)),
    safeRunModule("dns",        () => runDnsModule(hostname)),
    safeRunModule("cors",       () => runCorsModule(url)),
    safeRunModule("clientSide", () => runClientSideModule(html, root, url)),
    safeRunModule("forms",      () => runFormsModule(root, headers)),
    safeRunModule("cms",        () => runCmsModule(html, root, origin, headers)),
    safeRunModule("recon",      () => runReconModule(html, origin, hostname, url)),
    safeRunModule("privacy",    () => runPrivacyModule(html, root, url)),
  ]);

  // Collect results from settled promises
  const results: SecurityModuleResult[] = moduleResults.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return {
      moduleName: "unknown",
      issues: [],
      passedChecks: [],
      score: 50,
      data: { error: "Module promise rejected" },
    };
  });

  // Calculate weighted score
  let weightedTotal = 0;
  let weightSum = 0;
  const moduleDataMap: Record<string, unknown> = {};

  for (const result of results) {
    const weight = CATEGORY_WEIGHTS[result.moduleName] ?? 2;
    const cappedScore = applyScoreCaps(result.score, result.issues);
    weightedTotal += cappedScore * weight;
    weightSum += weight;
    moduleDataMap[result.moduleName] = result.data;
  }

  const finalScore = weightSum > 0 ? Math.round(weightedTotal / weightSum) : 50;

  // Collect all issues (tagged with category) and deduplicate
  const allIssues: AuditIssue[] = results.flatMap((r) =>
    r.issues.map((issue) => ({ ...issue, category: "security" as const }))
  );
  const uniqueIssues = deduplicateIssues(allIssues);

  // Collect all passed checks
  const allPassedChecks = results.flatMap((r) => r.passedChecks);

  // AI summary (best-effort)
  let aiSummary: string | null = null;
  try {
    const summaryData = results.map((r) => ({
      module: r.moduleName,
      score: r.score,
      issueCount: r.issues.length,
      topIssues: r.issues.slice(0, 2).map((i) => i.title),
    }));

    const aiResponse = await generateJson<{ summary: string; issues: Array<{ title: string; description: string; fixSuggestion: string; severity: string; impact: string; effort: string }> }>(
      `You are a senior application security engineer writing an executive summary.
Analyze these security module results and return JSON with "summary" (2-3 sentences) and "issues" (empty array — we already have detailed issues).
Host: ${hostname}
Overall Score: ${finalScore}/100
Grade: ${getGrade(finalScore)}
Module Results:
${JSON.stringify(summaryData, null, 2)}
Critical issues: ${uniqueIssues.filter((i) => i.severity === "critical").length}
Medium issues: ${uniqueIssues.filter((i) => i.severity === "medium").length}
Low issues: ${uniqueIssues.filter((i) => i.severity === "low").length}
Total passed checks: ${allPassedChecks.length}`,
      [],
      defaultIssueSchema
    );
    aiSummary = aiResponse?.summary ?? null;
  } catch {
    aiSummary = null;
  }

  const summary =
    aiSummary ??
    `Security audit completed across 11 modules. Score: ${finalScore}/100. Found ${uniqueIssues.filter((i) => i.severity === "critical").length} critical, ${uniqueIssues.filter((i) => i.severity === "medium").length} medium, and ${uniqueIssues.filter((i) => i.severity === "low").length} low severity issues.`;

  return {
    category: "security",
    score: finalScore,
    grade: getGrade(finalScore),
    summary,
    issues: uniqueIssues,
    passedChecks: allPassedChecks,
    data: {
      grade: getGrade(finalScore),
      score: finalScore,
      ...moduleDataMap,
    },
  };
}
