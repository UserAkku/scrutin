"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Input } from "@/components/shared/input";
import { googleLoginAction } from "@/lib/actions";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  async function handleSendOTP(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    
    setIsPending(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to send code");
      }
      
      setStep("code");
      setSuccessMsg("We sent a 6-digit code to your email.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  }

  async function handleVerifyOTP(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code) return;

    setIsPending(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        code,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid or expired code");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8 bg-[var(--pastel-pink)] relative">
        <p className="text-xs uppercase tracking-[0.22em] text-brutal-black/70 font-bold font-body">
          {step === "email" ? "Login / Sign up" : "Verify Email"}
        </p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl text-brutal-black">
          {step === "email" ? "Enter the Console" : "Enter Code"}
        </h1>

        {successMsg && (
          <div className="mt-4 p-3 border-2 border-brutal-black bg-[var(--pastel-green)] text-sm font-bold">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 border-2 border-brutal-black bg-[#FF8080] text-white text-sm font-bold">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOTP} className="mt-8 space-y-5">
            <Input 
              type="email" 
              placeholder="name@company.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
            />
            <Button type="submit" className="w-full" loading={isPending}>
              Continue with Email
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="mt-8 space-y-5">
            <Input 
              type="text" 
              placeholder="6-digit code" 
              value={code} 
              onChange={(e) => setCode(e.target.value)} 
              maxLength={6}
              className="text-center text-2xl tracking-widest font-display"
              required
            />
            <Button type="submit" className="w-full" loading={isPending}>
              Verify & Login
            </Button>
            <button 
              type="button" 
              onClick={() => { setStep("email"); setCode(""); setSuccessMsg(""); }}
              className="w-full text-center text-sm font-bold font-body hover:underline text-brutal-black/70 pt-2"
            >
              Use a different email
            </button>
          </form>
        )}

        {step === "email" && (
          <>
            <div className="my-6 flex items-center justify-center">
              <span className="bg-brutal-black/10 h-[2px] flex-1"></span>
              <span className="px-4 text-xs font-bold uppercase tracking-widest text-brutal-black/50">OR</span>
              <span className="bg-brutal-black/10 h-[2px] flex-1"></span>
            </div>
            
            <form action={googleLoginAction}>
              <Button type="submit" variant="secondary" className="w-full bg-white hover:bg-gray-100">
                Continue with Google
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
