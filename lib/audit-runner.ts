import type { Audit, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditCategory, CategoryResult } from "@/types/audit";
import { calculateOverallScore } from "@/lib/scoring";
import { analyzePerformance } from "@/lib/analyzers/performance";
import { analyzeSeo } from "@/lib/analyzers/seo";
import { analyzeSecurity } from "@/lib/analyzers/security/index";
import { analyzeUx } from "@/lib/analyzers/ux";
import { analyzeAccessibility } from "@/lib/analyzers/accessibility";
import { analyzeTechnical } from "@/lib/analyzers/technical";

const analyzers: Record<AuditCategory, (url: string) => Promise<CategoryResult>> = {
  performance: analyzePerformance,
  seo: analyzeSeo,
  security: analyzeSecurity,
  ux: analyzeUx,
  accessibility: analyzeAccessibility,
  technical: analyzeTechnical,
};

// Category weights for progress calculation (must sum to 100)
const CATEGORY_PROGRESS_WEIGHTS: Record<AuditCategory, number> = {
  performance: 20,
  seo: 20,
  security: 25,
  accessibility: 15,
  ux: 10,
  technical: 10,
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
  const issuePayload = result.issues.map((issue) => {
    const categoryName = (issue.category || result.category).toUpperCase();
    return {
      category: issue.category || result.category,
      severity: normalizeSeverity(issue.severity),
      title: issue.title || `${categoryName} Issue Detected`,
      description: issue.description || `An automated issue was found in the ${categoryName} category.`,
      fixSuggestion: issue.fixSuggestion || "Review and apply standard best practices for this area.",
      impact: issue.impact ?? null,
      effort: issue.effort ?? null,
    };
  });

  const update: Record<string, unknown> = {
    [`${result.category}Score`]: result.score,
    [`${result.category}Data`]: result.data as Prisma.InputJsonValue,
    issues: { create: issuePayload },
  };

  // Capture screenshots if UX analysis ran
  if (result.category === "ux") {
    const data = result.data as Record<string, unknown>;
    if (data?.desktopScreenshotBase64) {
      update.screenshotUrl = `data:image/png;base64,${data.desktopScreenshotBase64}`;
    }
    if (data?.mobileScreenshotBase64) {
      update.mobileScreenshotUrl = `data:image/png;base64,${data.mobileScreenshotBase64}`;
    }
  }

  // Capture tech stack from technical analysis
  if (result.category === "technical") {
    const data = result.data as Record<string, unknown>;
    if (data?.techStack) {
      update.techStack = data.techStack as Prisma.InputJsonValue;
    }
  }

  // Capture page title/description from SEO
  if (result.category === "seo") {
    const data = result.data as Record<string, unknown>;
    if (data?.title) update.targetTitle = data.title as string;
    if (data?.metaDescription) update.targetDescription = data.metaDescription as string;
  }

  return update as Prisma.AuditUpdateInput;
}

async function updateProgress(auditId: string, completedCategories: Set<AuditCategory>) {
  let progress = 0;
  for (const cat of completedCategories) {
    progress += CATEGORY_PROGRESS_WEIGHTS[cat] ?? 0;
  }
  await prisma.audit.update({
    where: { id: auditId },
    data: { progress: Math.min(progress, 95) }, // max 95% until fully complete
  });
}

export async function runAuditPipeline(audit: Audit): Promise<void> {
  // Reset issues and mark as running
  await prisma.issue.deleteMany({ where: { auditId: audit.id } });
  await prisma.audit.update({
    where: { id: audit.id },
    data: { status: "running", progress: 0, jobStartedAt: new Date() },
  });

  const categories = audit.isGuest
    ? (["performance", "seo", "technical"] as AuditCategory[])
    : (Object.keys(analyzers) as AuditCategory[]);

  const scoreAccumulator: Record<AuditCategory, number> = {
    performance: 0,
    seo: 0,
    security: 0,
    ux: 0,
    accessibility: 0,
    technical: 0,
  };

  const completedCategories = new Set<AuditCategory>();

  // Run all analyzers in parallel
  await Promise.allSettled(
    categories.map(async (category) => {
      // Mark this category as running
      await prisma.audit.update({
        where: { id: audit.id },
        data: { currentStep: category },
      }).catch(() => {}); // non-critical

      try {
        const result = await analyzers[category](audit.url);
        scoreAccumulator[category] = result.score;

        await prisma.audit.update({
          where: { id: audit.id },
          data: mapResultToUpdate(result),
        });

        completedCategories.add(category);
        await updateProgress(audit.id, completedCategories);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Analysis unavailable";
        const title = `${category.charAt(0).toUpperCase() + category.slice(1)} analysis unavailable`;

        await prisma.audit.update({
          where: { id: audit.id },
          data: {
            [`${category}Data`]: { error: message } as Prisma.InputJsonValue,
            issues: {
              create: {
                category,
                severity: "medium",
                title,
                description: `Krillo could not complete the ${category} audit: ${message}`,
                fixSuggestion: "Re-run the audit after confirming the target URL is reachable.",
                impact: message,
                effort: "5 minutes",
              },
            },
          },
        });

        completedCategories.add(category);
        await updateProgress(audit.id, completedCategories);
      }
    })
  );

  // Calculate overall score
  const overallScore = calculateOverallScore(scoreAccumulator, categories);

  await prisma.audit.update({
    where: { id: audit.id },
    data: {
      status: "complete",
      overallScore,
      progress: 100,
      currentStep: null,
      jobCompletedAt: new Date(),
    },
  });
}
