import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-foreground bg-panel shadow-inset transition-all duration-200 ease-in-out",
        className
      )}
      {...props}
    />
  );
}
