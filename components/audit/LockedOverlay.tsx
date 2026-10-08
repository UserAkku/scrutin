import Link from "next/link";
import { Button } from "@/components/shared/button";

export function LockedOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[1.75rem] bg-white/90 px-4 backdrop-blur-sm border-2 border-brutal-black">
      <div className="brutal-badge -top-3 -right-3 bg-[var(--pastel-pink)] w-12 h-12 text-2xl flex items-center justify-center absolute shadow-none">🔒</div>
      <p className="text-center font-display text-base uppercase leading-snug sm:text-xl md:text-2xl text-brutal-black mt-4">Unlock Full Analysis</p>
      <p className="max-w-md text-center text-sm font-bold font-body text-brutal-black/70 leading-relaxed">
        Security, UX/UI, and accessibility insights are available for free. Takes 30 seconds, no password required.
      </p>
      <Link href="/login">
        <Button>Unlock Report Free</Button>
      </Link>
    </div>
  );
}