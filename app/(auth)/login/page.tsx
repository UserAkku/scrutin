"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Input } from "@/components/shared/input";

import { loginAction, googleLoginAction } from "@/lib/actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError("");

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    formData.append("redirectTo", "/dashboard");

    const response = await loginAction(formData);
    
    if (response?.error) {
      setError(response.error);
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8 bg-[var(--pastel-pink)]">
        <p className="text-xs uppercase tracking-[0.22em] text-brutal-black/70 font-bold font-body">Login</p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl text-brutal-black">Return to the Console</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className="text-sm text-danger font-bold">{error}</p> : null}
          <Button type="submit" className="w-full" loading={isPending}>Sign In</Button>
        </form>
        <form action={googleLoginAction}>
          <Button type="submit" variant="secondary" className="mt-3 w-full">
            Continue with Google
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm font-bold font-body text-brutal-black/80">
          <Link href="/signup" className="hover:underline">Create account</Link>
          <Link href="/reset-password" className="hover:underline">Forgot password</Link>
        </div>
      </Card>
    </div>
  );
}
