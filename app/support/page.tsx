"use client";

import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Input } from "@/components/shared/input";

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="font-display text-4xl uppercase sm:text-6xl text-brutal-black">Contact Support</h1>
        <p className="mt-4 font-body font-bold text-brutal-black/70">Have a question? We're here to help.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="p-8 bg-[var(--pastel-blue)]">
          <h2 className="font-display text-2xl uppercase mb-6">Send a Message</h2>
          {success && (
            <div className="mb-6 p-4 border-2 border-brutal-black bg-[var(--pastel-green)] font-bold">
              Message sent successfully! We'll get back to you soon.
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 border-2 border-brutal-black bg-[#FF8080] text-white font-bold">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input type="email" placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <textarea 
              placeholder="How can we help?" 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              required
              rows={5}
              className="w-full rounded-lg border-[3px] border-brutal-black bg-white px-4 py-3 font-body text-base font-bold text-brutal-black placeholder:text-brutal-black/50 focus:outline-none focus:ring-4 focus:ring-brutal-black/10"
            />
            <Button type="submit" className="w-full" loading={isPending}>Send Message</Button>
          </form>
        </Card>

        <div className="space-y-8">
          <Card className="p-8 bg-[var(--pastel-yellow)]">
            <h2 className="font-display text-2xl uppercase mb-4">Direct Contact</h2>
            <p className="font-body font-bold text-brutal-black/80">
              Prefer email? Reach us directly at:
            </p>
            <a href="mailto:akhileshkumaroffical@gmail.com" className="inline-block mt-4 text-xl font-display uppercase tracking-widest hover:underline decoration-4 underline-offset-4">
              akhileshkumaroffical@gmail.com
            </a>
          </Card>

          <Card className="p-8 bg-[var(--pastel-pink)]">
            <h2 className="font-display text-2xl uppercase mb-4">FAQ</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg">How long do audits take?</h3>
                <p className="text-sm font-bold text-brutal-black/70">Usually 1-2 minutes depending on the page size.</p>
              </div>
              <div>
                <h3 className="font-bold text-lg">What does the free plan include?</h3>
                <p className="text-sm font-bold text-brutal-black/70">10 audits per day and full dashboard access.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
