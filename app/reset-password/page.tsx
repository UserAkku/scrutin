"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Input } from "@/components/shared/input";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = (await response.json()) as { resetUrl?: string };
      setMessage(data.resetUrl ? `Development reset link: ${data.resetUrl}` : "If that account exists, a reset link has been issued.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password })
    });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Password updated. You can sign in now." : data.error ?? "Reset failed.");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Password reset</p>
        <h1 className="mt-3 font-display text-3xl uppercase">{token ? "Set a New Password" : "Request Reset Link"}</h1>
        <form onSubmit={requestReset} className="mt-8 space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          {token ? (
            <>
              <Input placeholder="Reset token" value={token} onChange={(event) => setToken(event.target.value)} />
              <Input type="password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </>
          ) : null}
          <Button type="submit" className="w-full">{token ? "Reset Password" : "Send Reset Link"}</Button>
        </form>
        {message ? <p className="mt-4 break-all text-sm text-foreground/70">{message}</p> : null}
      </Card>
    </div>
  );
}
