"use client";

import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";

const FAQ_ITEMS = [
  {
    q: "How long do audits take?",
    a: "Usually 1–2 minutes depending on page size and server speed.",
  },
  {
    q: "What does the free plan include?",
    a: "10 audits per day, full report, and dashboard access.",
  },
  {
    q: "Is a password required to sign up?",
    a: "No. We use email OTP — just enter your email and a code, that's it.",
  },
  {
    q: "Can I share my audit with someone?",
    a: "Yes! Use the 'Share Report' button on any audit to copy a shareable link.",
  },
];

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
    <div className="min-h-[calc(100vh-80px)] bg-[var(--bg)] px-4 py-20">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border-[2.5px] border-brutal-black bg-white text-brutal-black font-bold uppercase tracking-widest text-xs mb-6">
            💬 Support
          </div>
          <h1 className="font-display text-5xl sm:text-7xl uppercase text-brutal-black leading-none">
            How can we<br />help you?
          </h1>
          <p className="mt-5 font-body font-bold text-brutal-black/60 text-lg">
            Fill out the form or reach out directly — we respond within 24h.
          </p>
        </div>

        {/* Main Grid: equal 2-column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* LEFT — Form */}
          <div className="border-[3px] border-brutal-black rounded-2xl bg-[var(--pastel-blue)] p-8 shadow-[6px_6px_0px_#2D2323]">
            <h2 className="font-display text-2xl uppercase tracking-widest mb-6 text-brutal-black">
              Send a Message
            </h2>

            {success && (
              <div className="mb-5 p-4 border-[2.5px] border-brutal-black bg-[var(--pastel-green)] font-bold font-body text-brutal-black rounded-lg">
                ✓ Message sent! We'll get back to you within 24 hours.
              </div>
            )}
            {error && (
              <div className="mb-5 p-4 border-[2.5px] border-brutal-black bg-[#FF8080] text-white font-bold font-body rounded-lg">
                ✗ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input type="email" placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              <textarea
                placeholder="Describe your issue or question..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                className="w-full rounded-xl border-[3px] border-brutal-black bg-white px-4 py-3 font-body text-base font-bold text-brutal-black placeholder:text-brutal-black/40 focus:outline-none focus:ring-4 focus:ring-brutal-black/10 resize-none"
              />
              <Button type="submit" className="w-full" loading={isPending}>
                Send Message →
              </Button>
            </form>
          </div>

          {/* RIGHT — Info */}
          <div className="flex flex-col gap-6">

            {/* Direct Contact */}
            <div className="border-[3px] border-brutal-black rounded-2xl bg-[var(--pastel-yellow)] p-8 shadow-[6px_6px_0px_#2D2323]">
              <h2 className="font-display text-2xl uppercase tracking-widest mb-4 text-brutal-black">
                Direct Contact
              </h2>
              <p className="font-body font-bold text-brutal-black/70 mb-4">
                Prefer to email directly? We've got you.
              </p>
              <a
                href="mailto:akhileshkumaroffical@gmail.com"
                className="inline-block font-display text-base uppercase tracking-widest border-b-[3px] border-brutal-black hover:bg-brutal-black hover:text-white px-2 py-1 transition-colors"
              >
                akhileshkumaroffical@gmail.com
              </a>
            </div>

            {/* FAQ — Accordion */}
            <div className="border-[3px] border-brutal-black rounded-2xl bg-[var(--pastel-pink)] p-8 shadow-[6px_6px_0px_#2D2323]">
              <h2 className="font-display text-2xl uppercase tracking-widest mb-5 text-brutal-black">
                FAQ
              </h2>
              <div className="space-y-2">
                {FAQ_ITEMS.map((item, i) => (
                  <div key={i} className="border-[2.5px] border-brutal-black rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between px-4 py-3 font-body font-bold text-sm text-left text-brutal-black hover:bg-[var(--pastel-yellow)] transition-colors"
                    >
                      <span>{item.q}</span>
                      <span className="text-lg ml-2 flex-shrink-0">{openFaq === i ? "−" : "+"}</span>
                    </button>
                    {openFaq === i && (
                      <div className="px-4 py-3 border-t-[2.5px] border-brutal-black font-body text-sm font-bold text-brutal-black/70 bg-white">
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
