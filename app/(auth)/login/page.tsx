"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Input } from "@/components/shared/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard"
    });

    if (response?.error) {
      setError("Invalid credentials.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Login</p>
        <h1 className="mt-3 font-display text-3xl uppercase">Return to the Console</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full">Sign In</Button>
        </form>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
          Continue with Google
        </Button>
        <div className="mt-6 flex items-center justify-between text-sm text-foreground/65">
          <Link href="/signup">Create account</Link>
          <Link href="/reset-password">Forgot password</Link>
        </div>
      </Card>
    </div>
  );
}
