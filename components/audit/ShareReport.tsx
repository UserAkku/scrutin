"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Switch } from "@/components/shared/switch";
import { CopyIcon, GlobeIcon } from "@/components/shared/icons";

export function ShareReport({
  auditId,
  initialIsPublic,
  canEdit
}: {
  auditId: string;
  initialIsPublic: boolean;
  canEdit: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setShareUrl(`${window.location.origin}/audit/${auditId}`);
  }, [auditId]);

  async function updateVisibility(next: boolean) {
    setIsPublic(next);
    const response = await fetch(`/api/audit/${auditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next })
    });
    if (!response.ok) {
      setIsPublic(!next);
      setMessage("Unable to update sharing right now.");
      return;
    }
    setMessage(next ? "Public report link enabled." : "Report is private again.");
  }

  async function copyLink() {
    if (!shareUrl) {
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setMessage("Public link copied to clipboard.");
  }

  return (
    <Card className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Share this report</p>
        <h3 className="mt-2 font-display text-2xl uppercase">Send a client-ready link</h3>
        <p className="mt-2 text-sm text-foreground/70">Public links respect the exact report state saved in the audit record.</p>
        {message ? <p className="mt-3 text-sm text-foreground/65">{message}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {canEdit ? (
          <label className="flex items-center gap-3 text-sm uppercase tracking-[0.14em]">
            <GlobeIcon className="h-4 w-4" />
            Public
            <Switch checked={isPublic} onCheckedChange={updateVisibility} />
          </label>
        ) : null}
        <Button variant="secondary" onClick={copyLink}>
          <CopyIcon className="h-4 w-4" />
          Copy Link
        </Button>
      </div>
    </Card>
  );
}
