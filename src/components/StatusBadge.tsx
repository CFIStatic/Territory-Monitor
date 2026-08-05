export function StatusBadge({
  value,
  kind = "neutral",
}: {
  value: string;
  kind?: "neutral" | "watch" | "warning" | "advisory" | "extreme" | "danger";
}) {
  const mapped =
    kind !== "neutral"
      ? kind
      : value === "warning" || value === "sending"
        ? "warning"
        : value === "extreme" || value === "failed" || value === "cancelled"
          ? "extreme"
          : value === "watch" || value === "approaching" || value === "sent" || value === "completed"
            ? "watch"
            : value === "advisory" || value === "queued" || value === "scheduled" || value === "forecast"
              ? "advisory"
              : "neutral";

  return <span className={`badge badge-${mapped}`}>{value}</span>;
}
