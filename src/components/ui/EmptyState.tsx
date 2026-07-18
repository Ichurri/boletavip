import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* Shared empty-state pattern (mockup #11c): tinted 56px circle with an
   icon, short title, up to two lines of muted subtext, optional CTA.
   Replaces the emoji-based empty states across the app. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </div>
      <p className="text-[15px] font-bold">{title}</p>
      {description ? (
        <p className="max-w-sm text-[12.5px] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
