"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GlobeIcon, ShieldIcon, TimerIcon } from "lucide-react";

export function AuditInputForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
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
    <div className="w-full max-w-2xl mx-auto xl:mx-0">
      <form onSubmit={onSubmit} className="relative z-10 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brutal-black">
            <GlobeIcon className="w-6 h-6" />
          </div>
          <input
            type="text"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="example.com"
            className="w-full pl-12 pr-4 py-4 brutal-input text-lg font-bold placeholder:font-normal placeholder:text-gray-500"
            disabled={isPending}
          />
        </div>
        <button
          type="submit"
          className="brutal-btn text-xl px-8 py-4 sm:w-auto w-full flex items-center justify-center gap-2"
          disabled={isPending || !url.trim()}
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Scanning...
            </>
          ) : (
            "Analyze Now"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 text-base font-bold text-red-600 flex items-center gap-2 font-body">
          <span className="w-2 h-2 rounded-full bg-red-600 border-2 border-brutal-black" />
          {error}
        </div>
      )}

      {!isPending && (
        <div className="mt-8 flex flex-wrap gap-6 items-center text-sm text-brutal-black font-bold font-body">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-5 h-5" />
            <span>200+ checks per audit</span>
          </div>
          <div className="flex items-center gap-2">
            <TimerIcon className="w-5 h-5" />
            <span>Background processing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full border-2 border-brutal-black bg-white flex items-center justify-center text-xs">
              ✓
            </span>
            <span>Free to start</span>
          </div>
        </div>
      )}
      
    </div>
  );
}
