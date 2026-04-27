"use client";

import { useEffect, useState } from "react";
import type { ProgressEvent } from "@/types/audit";
import { Card } from "@/components/shared/card";
import { ProgressBar } from "@/components/shared/progress";

const labels = ["performance", "seo", "security", "ux", "accessibility", "technical"] as const;

export function AuditProgress({ auditId }: { auditId: string }) {
  const [events, setEvents] = useState<Record<string, ProgressEvent>>({});
  const [overall, setOverall] = useState(0);

  useEffect(() => {
    const source = new EventSource(`/api/audit/${auditId}/stream`);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as ProgressEvent;
      if (payload.category) {
        setEvents((current) => ({ ...current, [payload.category!]: payload }));
      }
      if (payload.overallScore) {
        setOverall(payload.overallScore);
      }
      if (payload.status === "complete" && !payload.category) {
        source.close();
      }
    };
    return () => source.close();
  }, [auditId]);

  const completed = labels.filter((label) => events[label]?.status === "complete").length;
  const progress = Math.round((completed / labels.length) * 100);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Real-time audit progress</p>
            <h2 className="mt-2 font-display text-2xl uppercase">{overall > 0 ? `Overall ${overall}` : "Running analysis"}</h2>
          </div>
          <div className="text-right text-sm text-foreground/60">{completed}/{labels.length} complete</div>
        </div>
        <ProgressBar value={progress} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {labels.map((label) => (
            <div key={label} className="border border-black/10 p-3 text-sm uppercase tracking-[0.14em]">
              <div className="flex items-center justify-between">
                <span>{label}</span>
                <span>{events[label]?.status ?? "queued"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
