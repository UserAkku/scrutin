import Link from "next/link";
import { Button } from "@/components/shared/button";

export function LockedOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[1.75rem] bg-background/85 backdrop-blur-sm">
      <p className="font-display text-2xl uppercase">Unlock Full Report</p>
      <p className="max-w-sm text-center text-sm text-foreground/65">
        Security, UX/UI, and accessibility insights are available after free signup.
      </p>
      <Link href="/signup">
        <Button>Sign Up Free</Button>
      </Link>
    </div>
  );
}
