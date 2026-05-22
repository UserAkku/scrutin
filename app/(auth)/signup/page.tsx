"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Input } from "@/components/shared/input";

import { loginAction, googleLoginAction } from "@/lib/actions";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to create account.");
      setIsPending(false);
      return;
    }
    
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    formData.append("redirectTo", "/dashboard");

    const authResponse = await loginAction(formData);
    if (authResponse?.error) {
      setError(authResponse.error);
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8 bg-[var(--pastel-blue)]">
        <p className="text-xs uppercase tracking-[0.22em] text-brutal-black/70 font-bold font-body">Create account</p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl text-brutal-black">Unlock Full Analysis</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className="text-sm text-danger font-bold">{error}</p> : null}
          <Button type="submit" className="w-full" loading={isPending}>Create Account</Button>
        </form>
        <form action={googleLoginAction}>
          <Button type="submit" variant="secondary" className="mt-3 w-full">
            Continue with Google
          </Button>
        </form>
        <p className="mt-6 text-sm font-bold font-body text-brutal-black/80">
          Already have an account? <Link href="/login" className="underline hover:no-underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
