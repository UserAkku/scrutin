"use client";

import * as Progress from "@radix-ui/react-progress";

export function ProgressBar({ value }: { value: number }) {
  return (
    <Progress.Root className="relative h-3 w-full overflow-hidden rounded-full border border-black bg-background">
      <Progress.Indicator
        className="h-full bg-black transition-all duration-500 ease-in-out"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </Progress.Root>
  );
}
