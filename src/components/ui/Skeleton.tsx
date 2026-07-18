import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/* Violet shimmer placeholder ("Función Nocturna": skeletons are never
   neutral gray). Compose into view-specific silhouettes. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer rounded-xl bg-muted", className)}
      {...props}
    />
  );
}

/* Silhouette of an EventCard: 16:9 poster + title + meta lines. */
export function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-card">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-3 w-16 rounded-md" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
        <div className="mt-1 flex items-center justify-between">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}
