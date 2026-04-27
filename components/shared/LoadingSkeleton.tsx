import { Card } from "@/components/shared/card";
import { Skeleton } from "@/components/shared/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="space-y-4 p-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      ))}
    </div>
  );
}
