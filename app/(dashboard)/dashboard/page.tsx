import { redirect } from "next/navigation";
import { AuditHistory } from "@/components/dashboard/AuditHistory";
import { AuditLimitBanner } from "@/components/dashboard/AuditLimitBanner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const audits = await prisma.audit.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 md:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Dashboard</p>
        <h1 className="mt-3 font-display text-3xl uppercase sm:text-5xl">Audit History</h1>
      </div>
      <AuditLimitBanner auditsToday={session.user.auditsToday} />
      <AuditHistory
        audits={audits.map((audit) => ({
          id: audit.id,
          url: audit.url,
          overallScore: audit.overallScore,
          status: audit.status,
          createdAt: audit.createdAt.toISOString()
        }))}
      />
    </div>
  );
}
