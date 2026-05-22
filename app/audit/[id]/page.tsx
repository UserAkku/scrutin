import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAuditForViewer } from "@/lib/audit-access";
import { AuditProgressView } from "@/components/audit/AuditProgressView";
import { AuditReportClient } from "./AuditReportClient";

export default async function AuditPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const audit = await getAuditForViewer(params.id, session?.user?.id);

  if (!audit) {
    notFound();
  }

  // If the audit is not complete, show the live progress view
  if (audit.status !== "complete") {
    return (
      <AuditProgressView
        auditId={audit.id}
        hostname={audit.hostname}
        initialProgress={audit.progress}
        initialStatus={audit.status}
        initialStep={audit.currentStep}
      />
    );
  }

  // If complete, serialize the date and pass to the client component
  const serializedAudit = {
    ...audit,
    createdAt: audit.createdAt.toISOString(),
    jobStartedAt: audit.jobStartedAt?.toISOString() ?? null,
    jobCompletedAt: audit.jobCompletedAt?.toISOString() ?? null,
  };

  return <AuditReportClient audit={serializedAudit} currentUserId={session?.user?.id} />;
}
