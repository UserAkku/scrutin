"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/shared/card";
import { Button } from "@/components/shared/button";
import { CheckIcon } from "@/components/shared/icons";

export function Pricing() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleNotify = async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/notify-pro", { method: "POST" });
      const data = await res.json();
      
      if (data.requiresLogin) {
        router.push("/login?redirect=/#pricing");
        return;
      }
      
      if (!res.ok) throw new Error(data.error);
      
      setMessage(data.message || "Added to waitlist!");
    } catch (err: any) {
      setMessage(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-8">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.22em] text-brutal-black/70 font-body font-bold">Pricing</p>
        <h2 className="mt-3 font-display text-4xl uppercase sm:text-5xl md:text-6xl text-brutal-black">Start Free. Scale Later.</h2>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="brutal-card p-8 bg-[var(--pastel-green)] relative">
          <p className="text-xs uppercase tracking-[0.18em] font-bold text-brutal-black/70 font-body">Free</p>
          <h3 className="mt-4 font-display text-6xl uppercase text-brutal-black">$0</h3>
          <p className="mt-3 text-base leading-7 font-body text-brutal-black/80 font-bold">Partial guest audits, full account dashboard, 10 saved audits per day, and shareable reports.</p>
          <div className="mt-8 space-y-4 text-base font-body font-bold text-brutal-black">
            {["10 audits/day", "Full report after signup", "History for last 20 audits", "PDF export"].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckIcon className="h-5 w-5" />
                {feature}
              </div>
            ))}
          </div>
          <Link href="/signup" className="mt-8 block">
            <Button className="w-full text-xl py-6">Create Free Account</Button>
          </Link>
        </div>
        <div className="brutal-card p-8 bg-[var(--pastel-blue)] relative">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] font-bold text-brutal-black/70 font-body">Pro</p>
            <span className="border-2 border-brutal-black rounded-full bg-white text-brutal-black px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-display">Coming Soon</span>
          </div>
          <h3 className="mt-4 font-display text-6xl uppercase text-brutal-black">$49</h3>
          <p className="mt-3 text-base leading-7 font-body text-brutal-black/80 font-bold">Higher volume, white-labeled PDFs, client workspaces, scheduled re-audits, and deeper competitive tracking.</p>
          <div className="mt-8 space-y-4 text-base font-body font-bold text-brutal-black">
            {["Unlimited audits", "Agency-ready exports", "Branded public links", "Priority queue"].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckIcon className="h-5 w-5 text-brutal-black" />
                {feature}
              </div>
            ))}
          </div>
          
          {message && (
            <div className="mt-4 p-3 border-2 border-brutal-black bg-[var(--pastel-yellow)] text-sm font-bold text-center">
              {message}
            </div>
          )}
          
          <Button 
            variant="secondary" 
            className="mt-8 w-full text-xl py-6 bg-white hover:bg-gray-100 disabled:opacity-50" 
            type="button"
            onClick={handleNotify}
            disabled={isLoading}
          >
            {isLoading ? "Joining..." : "Notify Me"}
          </Button>
        </div>
      </div>
    </section>
  );
}
