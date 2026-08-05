export const STORM_TYPES = [
  { value: "thunderstorm", label: "Thunderstorm" },
  { value: "tornado", label: "Tornado" },
  { value: "hail", label: "Hail" },
  { value: "hurricane", label: "Hurricane" },
  { value: "flood", label: "Flood" },
  { value: "winter", label: "Winter Storm" },
  { value: "wind", label: "High Wind" },
] as const;

export const SEVERITY_LEVELS = [
  { value: "advisory", label: "Advisory", rank: 1 },
  { value: "watch", label: "Watch", rank: 2 },
  { value: "warning", label: "Warning", rank: 3 },
  { value: "extreme", label: "Extreme", rank: 4 },
] as const;

export const STORM_STATUSES = [
  { value: "forecast", label: "Forecast" },
  { value: "approaching", label: "Approaching" },
  { value: "active", label: "Active" },
  { value: "passed", label: "Passed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const CAMPAIGN_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function severityRank(severity: string): number {
  const found = SEVERITY_LEVELS.find((s) => s.value === severity);
  return found?.rank ?? 0;
}

export function meetsMinSeverity(actual: string, minimum: string): boolean {
  return severityRank(actual) >= severityRank(minimum);
}
