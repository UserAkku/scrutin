import { AuditHistoryCard } from "@/components/dashboard/AuditHistoryCard";

export function AuditHistory({
  audits
}: {
  audits: Array<{
    id: string;
    url: string;
    overallScore: number;
    status: string;
    createdAt: string;
  }>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {audits.map((audit) => (
        <AuditHistoryCard key={audit.id} audit={audit} />
      ))}
    </div>
  );
}
