import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full border border-black bg-panel px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-foreground/45 focus:border-foreground",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
