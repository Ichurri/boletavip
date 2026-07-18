import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
        ))}
      </div>

      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
