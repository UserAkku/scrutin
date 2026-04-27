"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Input } from "@/components/shared/input";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to create account.");
      return;
    }
    await signIn("credentials", { email, password, callbackUrl: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Create account</p>
        <h1 className="mt-3 font-display text-2xl uppercase sm:text-3xl">Unlock Full Analysis</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full">Create Account</Button>
        </form>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
          Continue with Google
        </Button>
        <p className="mt-6 text-sm text-foreground/65">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
