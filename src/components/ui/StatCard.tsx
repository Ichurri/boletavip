import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: { text: string; tone?: "success" | "warning" };
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <p
          className="truncate font-display text-2xl font-extrabold"
          title={value}
        >
          {value}
        </p>
        {sub && (
          <span
            className={cn(
              "text-xs",
              sub.tone === "success"
                ? "text-success"
                : sub.tone === "warning"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {sub.text}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
