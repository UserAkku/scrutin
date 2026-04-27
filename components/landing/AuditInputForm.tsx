"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";

export function AuditInputForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const data = (await response.json()) as { auditId?: string; error?: string };
      if (!response.ok || !data.auditId) {
        setError(data.error ?? "Unable to start audit.");
        return;
      }

      router.push(`/audit/${data.auditId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
          className="h-14 text-base"
        />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Analyzing" : "Analyze Now"}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
