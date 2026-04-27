
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuditHistory } from "@/components/dashboard/AuditHistory";
import { AuditLimitBanner } from "@/components/dashboard/AuditLimitBanner";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, audits] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { auditsToday: true }
    }),
    prisma.audit.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const auditRows = audits.map((audit) => ({
    id: audit.id,
    url: audit.url,
    overallScore: audit.overallScore,
    status: audit.status,
    createdAt: audit.createdAt.toISOString()
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 md:px-8">
      <Card className="p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Account dashboard</p>
            <h1 className="mt-2 font-display text-2xl uppercase sm:text-4xl">Your audits</h1>
          </div>
          <Link href="/">
            <Button size="sm">Run new audit</Button>
          </Link>
        </div>
      </Card>

      <AuditLimitBanner auditsToday={user?.auditsToday ?? 0} />

      {auditRows.length > 0 ? (
        <AuditHistory audits={auditRows} />
      ) : (
        <Card className="p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">No audits yet</p>
          <p className="mt-3 text-sm text-foreground/65">Start your first audit to see reports here.</p>
          <div className="mt-6">
            <Link href="/">
              <Button size="sm">Start an audit</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
