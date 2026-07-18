import { cn } from "@/lib/utils";
import { CheckIcon } from "@/components/ui/icons";

/* Shared progress stepper (mockup #12c), the single "progress" pattern of
   the app: payment guide (t4) and event-creation wizard (t12).
   done = success green + check · active = violet + glow · upcoming = outline.
   Connector line turns green once the previous step is done. */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-start", className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            className={cn("flex min-w-0 items-start", i > 0 && "flex-1")}
            aria-current={active ? "step" : undefined}
          >
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 mt-4 h-0.5 flex-1 rounded-full",
                  done || active ? "bg-success" : "bg-border",
                )}
              />
            ) : null}
            <span className="flex max-w-24 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-colors duration-200",
                  done && "border-success bg-success text-white",
                  active &&
                    "border-primary bg-primary text-primary-foreground shadow-glow-ring",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight",
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
                {done ? <span className="sr-only"> (completado)</span> : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
