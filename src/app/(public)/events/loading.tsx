import { EventCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-[136px] rounded-2xl sm:h-[92px] lg:h-[76px]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
