import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse-line rounded-md bg-black/10", className)}
      aria-hidden="true"
    />
  );
}
