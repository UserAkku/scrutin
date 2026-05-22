import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, audits] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, auditsToday: true, plan: true, createdAt: true },
    }),
    prisma.audit.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        url: true,
        hostname: true,
        faviconUrl: true,
        status: true,
        progress: true,
        overallScore: true,
        performanceScore: true,
        seoScore: true,
        securityScore: true,
        uxScore: true,
        accessibilityScore: true,
        technicalScore: true,
        targetTitle: true,
        techStack: true,
        isPublic: true,
        isGuest: true,
        createdAt: true,
        jobCompletedAt: true,
        _count: { select: { issues: true } },
      },
    }),
  ]);

  // Compute stats
  const completedAudits = audits.filter((a) => a.status === "complete");
  const avgScore = completedAudits.length
    ? Math.round(completedAudits.reduce((s, a) => s + a.overallScore, 0) / completedAudits.length)
    : 0;
  const totalIssues = audits.reduce((s, a) => s + (a._count?.issues ?? 0), 0);
  const runningAudits = audits.filter((a) => a.status === "running" || a.status === "pending");

  const serialized = audits.map((a) => ({
    ...a,
    techStack: a.techStack as Record<string, string> | null,
    createdAt: a.createdAt.toISOString(),
    jobCompletedAt: a.jobCompletedAt?.toISOString() ?? null,
    issueCount: a._count?.issues ?? 0,
  }));

  return (
    <DashboardClient
      user={{
        name: user?.name ?? null,
        email: user?.email ?? "",
        plan: user?.plan ?? "free",
        auditsToday: user?.auditsToday ?? 0,
        memberSince: user?.createdAt?.toISOString() ?? "",
      }}
      audits={serialized}
      stats={{
        total: audits.length,
        avgScore,
        totalIssues,
        running: runningAudits.length,
      }}
    />
  );
}
