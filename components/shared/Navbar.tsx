"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/shared/button";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-brutal-black bg-[var(--lime)] py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 md:px-8">
        <Link href="/" className="group flex items-center gap-[3px] sm:gap-1">
          {(["K","R","I","L","L","O"] as const).map((letter, i) => {
            const colors = [
              "var(--pastel-pink)",
              "var(--pastel-blue)",
              "#E7F664",
              "var(--pastel-green)",
              "var(--pastel-yellow)",
              "white",
            ];
            const rotations = [
              "-rotate-3",
              "rotate-2",
              "-rotate-1",
              "rotate-3",
              "-rotate-2",
              "rotate-1",
            ];
            const hoverRotations = [
              "group-hover:rotate-6",
              "group-hover:-rotate-6",
              "group-hover:rotate-6",
              "group-hover:-rotate-6",
              "group-hover:rotate-6",
              "group-hover:-rotate-6",
            ];
            return (
              <span
                key={i}
                className={`inline-flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 border-[2.5px] border-brutal-black font-display text-sm sm:text-lg md:text-xl font-black text-brutal-black select-none transition-all duration-200 ${rotations[i]} ${hoverRotations[i]} group-hover:-translate-y-1 group-hover:shadow-[2px_2px_0px_#2D2323]`}
                style={{ backgroundColor: colors[i], transitionDelay: `${i * 30}ms` }}
              >
                {letter}
              </span>
            );
          })}
        </Link>
        
        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-4">
          {session?.user ? (
            <>
              <Link href="/dashboard">
                <Button variant="default" size="sm">Dashboard</Button>
              </Link>
              <Button size="sm" variant="danger" onClick={() => signOut({ callbackUrl: "/" })}>Logout</Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button className="sm:hidden p-2" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-[var(--lime)] border-b-[3px] border-brutal-black p-4 flex flex-col gap-4 sm:hidden">
          {session?.user ? (
            <>
              <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                <Button variant="default" className="w-full justify-start">Dashboard</Button>
              </Link>
              <Button variant="danger" className="w-full justify-start" onClick={() => signOut({ callbackUrl: "/" })}>Logout</Button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Sign In</Button>
              </Link>
              <Link href="/signup" onClick={() => setIsOpen(false)}>
                <Button className="w-full justify-start">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
