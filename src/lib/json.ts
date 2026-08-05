export function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function toJsonArray(values: string[] | string | null | undefined): string {
  if (!values) return "[]";
  if (typeof values === "string") {
    return JSON.stringify(parseStringArray(values));
  }
  return JSON.stringify(values.map((v) => v.trim()).filter(Boolean));
}

export function normalizePlace(value: string): string {
  return value.trim().toLowerCase();
}
