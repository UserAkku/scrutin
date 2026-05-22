import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full bg-white border-brutal border-brutal-black rounded-xl shadow-brutal px-4 py-3 text-brutal-black font-body outline-none transition-all duration-200 placeholder:text-brutal-black/50 focus:-translate-y-1 focus:shadow-brutal-lg",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
