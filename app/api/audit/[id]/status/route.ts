import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/audit/[id]/status
 * Lightweight polling endpoint — returns current audit status + progress.
 * Client polls this every 3 seconds while audit is running.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const { id } = params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      isGuest: true,
      isPublic: true,
      status: true,
      progress: true,
      currentStep: true,
      overallScore: true,
      performanceScore: true,
      seoScore: true,
      securityScore: true,
      uxScore: true,
      accessibilityScore: true,
      technicalScore: true,
      jobStartedAt: true,
      jobCompletedAt: true,
      createdAt: true,
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  // Access control: guest audits are visible to anyone with the ID
  // Logged-in audits are only visible to the owner OR if isPublic
  const isOwner = session?.user?.id && audit.userId === session.user.id;
  const canView = audit.isGuest || audit.isPublic || isOwner;

  if (!canView) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Calculate elapsed time
  const elapsedMs = audit.jobStartedAt
    ? (audit.jobCompletedAt ?? new Date()).getTime() - audit.jobStartedAt.getTime()
    : 0;

  return NextResponse.json({
    id: audit.id,
    status: audit.status,
    progress: audit.progress,
    currentStep: audit.currentStep,
    elapsedMs,
    scores: {
      overall: audit.overallScore,
      performance: audit.performanceScore,
      seo: audit.seoScore,
      security: audit.securityScore,
      ux: audit.uxScore,
      accessibility: audit.accessibilityScore,
      technical: audit.technicalScore,
    },
  });
}
