"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch(props: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border border-foreground bg-background transition-colors data-[state=checked]:bg-foreground"
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 translate-x-1 rounded-full bg-foreground transition-transform duration-200 data-[state=checked]:translate-x-8 data-[state=checked]:bg-background" />
    </SwitchPrimitive.Root>
  );
}
