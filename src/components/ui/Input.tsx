import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

const inputClasses =
  "h-12 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-card-foreground transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({
  leftIcon,
  className,
  ...props
}: ComponentProps<"input"> & { leftIcon?: ReactNode }) {
  if (!leftIcon) {
    return <input className={cn(inputClasses, className)} {...props} />;
  }
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4"
      >
        {leftIcon}
      </span>
      <input className={cn(inputClasses, "pl-10", className)} {...props} />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-12 w-full cursor-pointer rounded-xl border border-border bg-card px-3.5 text-sm text-card-foreground transition-colors duration-200 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-card-foreground transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-danger">{message}</p>;
}
