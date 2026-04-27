import type { Audit, Issue } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getAuditForViewer(auditId: string, userId?: string | null) {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      issues: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  if (!audit) {
    return null;
  }

  if (!audit.isPublic && audit.userId && audit.userId !== userId) {
    return null;
  }

  if (!audit.isPublic && audit.isGuest && !userId) {
    return audit;
  }

  return audit;
}

export function getQuickWins(issues: Issue[]) {
  return issues
    .filter((issue) => issue.severity !== "critical")
    .slice(0, 5)
    .map((issue) => ({
      title: issue.title,
      fixSuggestion: issue.fixSuggestion,
      category: issue.category
    }));
}

export function serializeAudit(audit: Audit & { issues: Issue[] }) {
  return {
    ...audit,
    createdAt: audit.createdAt.toISOString(),
    updatedAt: audit.updatedAt.toISOString()
  };
}
