"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { formatDate } from "@/lib/utils";

export function AuditHistoryCard({
  audit
}: {
  audit: {
    id: string;
    url: string;
    overallScore: number;
    status: string;
    createdAt: string;
  };
}) {
  const router = useRouter();

  async function deleteAudit() {
    await fetch(`/api/audit/${audit.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function reAudit() {
    const response = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: audit.url })
    });
    const data = (await response.json()) as { auditId?: string };
    if (data.auditId) {
      router.push(`/audit/${data.auditId}`);
    }
  }

  return (
    <Card className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">{audit.status}</p>
      <h3 className="mt-3 font-display text-2xl uppercase break-all">{audit.url}</h3>
      <p className="mt-3 text-sm text-foreground/65">{formatDate(audit.createdAt)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/audit/${audit.id}`}>
          <Button size="sm">Open</Button>
        </Link>
        <Button size="sm" variant="secondary" onClick={reAudit}>Re-Audit</Button>
        <Button size="sm" variant="ghost" onClick={deleteAudit}>Delete</Button>
      </div>
    </Card>
  );
}
