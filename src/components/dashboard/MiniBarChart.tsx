/* Plain CSS bars, no chart library — 7 days of confirmed-order counts. */
export function MiniBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((day) => day.value));

  return (
    <div className="flex items-end gap-2 sm:gap-3">
      {data.map((day, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
            {day.value}
          </span>
          <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-muted">
            <div
              className="w-full rounded-t-md bg-primary transition-[height] duration-300"
              style={{ height: `${Math.round((day.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{day.label}</span>
        </div>
      ))}
    </div>
  );
}
