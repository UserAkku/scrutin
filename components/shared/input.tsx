import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full bg-white border-brutal border-brutal-black rounded-xl px-4 py-3 text-brutal-black font-body outline-none transition-all duration-200 placeholder:text-brutal-black/50 focus:-translate-y-1",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
