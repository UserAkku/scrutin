import type { AuditCategory, AuditIssue } from "@/types/audit";
import { getGrade } from "@/lib/utils";

const weights: Record<AuditCategory, number> = {
  performance: 0.25,
  seo: 0.2,
  security: 0.2,
  ux: 0.15,
  accessibility: 0.1,
  technical: 0.1
};

export function calculateOverallScore(
  scores: Record<AuditCategory, number>,
  categories?: AuditCategory[]
) {
  const activeCategories = categories ?? (Object.keys(weights) as AuditCategory[]);
  const weightTotal = activeCategories.reduce(
    (sum, category) => sum + weights[category],
    0
  );

  if (weightTotal === 0) {
    return 0;
  }

  const total = activeCategories.reduce((sum, category) => {
    return sum + scores[category] * weights[category];
  }, 0);

  return Math.round(total / weightTotal);
}

export function summarizeIssues(issues: AuditIssue[]) {
  return issues.reduce(
    (accumulator, issue) => {
      accumulator[issue.severity] += 1;
      return accumulator;
    },
    { critical: 0, medium: 0, low: 0 }
  );
}

export function scoreFromIssueDensity(
  issueCount: number,
  criticalMultiplier = 12,
  mediumMultiplier = 6,
  lowMultiplier = 3,
  issues: AuditIssue[] = []
) {
  if (issues.length === 0) {
    return 96;
  }

  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "critical") return sum + criticalMultiplier;
    if (issue.severity === "medium") return sum + mediumMultiplier;
    return sum + lowMultiplier;
  }, issueCount * 1.5);

  return Math.max(15, Math.min(100, Math.round(100 - penalty)));
}

export function toCategoryScore(score: number, issueCount: number) {
  return {
    score,
    grade: getGrade(score),
    issueCount
  };
}
