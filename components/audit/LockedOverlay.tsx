import Link from "next/link";
import { Button } from "@/components/shared/button";

export function LockedOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[1.75rem] bg-background/85 px-4 backdrop-blur-sm">
      <p className="text-center font-display text-base uppercase leading-snug sm:text-xl md:text-2xl">Unlock Full Report</p>
      <p className="max-w-sm text-center text-xs text-foreground/65 sm:text-sm">
        Security, UX/UI, and accessibility insights are available after free signup.
      </p>
      <Link href="/signup">
        <Button>Sign Up Free</Button>
      </Link>
    </div>
  );
}