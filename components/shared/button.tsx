"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border border-foreground transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5",
        secondary: "bg-panel text-foreground hover:bg-foreground hover:text-background",
        ghost: "border-transparent bg-transparent shadow-none hover:bg-foreground hover:text-background"
      },
      size: {
        default: "h-12 px-5 py-2 text-sm font-semibold uppercase tracking-[0.18em]",
        sm: "h-10 px-4 text-xs font-semibold uppercase tracking-[0.14em]",
        lg: "h-14 px-6 text-sm font-semibold uppercase tracking-[0.24em]"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
