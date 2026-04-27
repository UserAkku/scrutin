import type { Audit, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishAuditEvent } from "@/lib/stream";
import type { AuditCategory, CategoryResult, ProgressEvent } from "@/types/audit";
import { calculateOverallScore } from "@/lib/scoring";
import { analyzePerformance } from "@/lib/analyzers/performance";
import { analyzeSeo } from "@/lib/analyzers/seo";
import { analyzeSecurity } from "@/lib/analyzers/security";
import { analyzeUx } from "@/lib/analyzers/ux";
import { analyzeAccessibility } from "@/lib/analyzers/accessibility";
import { analyzeTechnical } from "@/lib/analyzers/technical";

const analyzers: Record<AuditCategory, (url: string) => Promise<CategoryResult>> = {
  performance: analyzePerformance,
  seo: analyzeSeo,
  security: analyzeSecurity,
  ux: analyzeUx,
  accessibility: analyzeAccessibility,
  technical: analyzeTechnical
};

function normalizeSeverity(raw: string | undefined | null): string {
  if (!raw) return "medium";
  const lower = raw.toLowerCase().trim();
  if (lower === "critical" || lower === "high") return "critical";
  if (lower === "medium" || lower === "moderate") return "medium";
  if (lower === "low" || lower === "info" || lower === "informational") return "low";
  return "medium";
}

function mapResultToUpdate(result: CategoryResult): Prisma.AuditUpdateInput {
  const issuePayload = result.issues.map((issue) => ({
    category: issue.category || result.category,
    severity: normalizeSeverity(issue.severity),
    title: issue.title || `${result.category} issue detected`,
    description: issue.description || "An issue was detected during the audit.",
    fixSuggestion: issue.fixSuggestion || "Review this area and apply best practices.",
    impact: issue.impact ?? null,
    effort: issue.effort ?? null
  }));

  return {
    [`${result.category}Score`]: result.score,
    [`${result.category}Data`]: result.data as Prisma.InputJsonValue,
    issues: {
      create: issuePayload
    }
  } as Prisma.AuditUpdateInput;
}

function resultEvent(result: CategoryResult): ProgressEvent {
  return {
    category: result.category,
    status: "complete",
    score: result.score,
    message: result.summary
  };
}

function errorUpdate(
  category: AuditCategory,
  message: string
): Prisma.AuditUpdateInput {
  const title = `${category.toUpperCase()} analysis unavailable`;
  return {
    [`${category}Data`]: {
      error: message
    } as Prisma.InputJsonValue,
    issues: {
      create: {
        category,
        severity: "medium",
        title,
        description: `Scrutin could not complete the ${category} audit for this run.`,
        fixSuggestion:
          "Re-run the audit after confirming the target URL is reachable and the required API key or external service is available.",
        impact: message,
        effort: "5 minutes"
      }
    }
  } as Prisma.AuditUpdateInput;
}

export async function runAuditPipeline(audit: Audit) {
  await prisma.issue.deleteMany({ where: { auditId: audit.id } });
  await prisma.audit.update({
    where: { id: audit.id },
    data: { status: "running" }
  });

  publishAuditEvent(audit.id, { status: "running", message: "Audit started" });

  const categories = audit.isGuest
    ? (["performance", "seo", "technical"] as AuditCategory[])
    : (Object.keys(analyzers) as AuditCategory[]);

  const scoreAccumulator: Record<AuditCategory, number> = {
    performance: 0,
    seo: 0,
    security: 0,
    ux: 0,
    accessibility: 0,
    technical: 0
  };

  await Promise.allSettled(
    categories.map(async (category) => {
      publishAuditEvent(audit.id, { category, status: "running" });
      try {
        const result = await analyzers[category](audit.url);
        scoreAccumulator[category] = result.score;
        await prisma.audit.update({
          where: { id: audit.id },
          data: mapResultToUpdate(result)
        });
        publishAuditEvent(audit.id, resultEvent(result));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Analysis unavailable";
        await prisma.audit.update({
          where: { id: audit.id },
          data: errorUpdate(category, message)
        });
        publishAuditEvent(audit.id, {
          category,
          status: "error",
          message
        });
      }
    })
  );

  const overallScore = calculateOverallScore(scoreAccumulator, categories);
  await prisma.audit.update({
    where: { id: audit.id },
    data: {
      status: "complete",
      overallScore
    }
  });

  publishAuditEvent(audit.id, {
    status: "complete",
    overallScore
  });
}
