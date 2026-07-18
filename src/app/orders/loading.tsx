import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
