/**
 * Sanitize untrusted contact / form strings before DB write.
 * Strips control chars, nulls, and caps field lengths to limit payload abuse.
 */

const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MAX_LEN: Record<string, number> = {
  firstName: 80,
  lastName: 80,
  email: 254,
  phone: 40,
  address: 200,
  city: 100,
  state: 2,
  zip: 16,
  company: 120,
  spouseName: 80,
  familyNotes: 500,
  personalTouch: 500,
  lastConversation: 500,
  notes: 1000,
};

export function sanitizeText(value: string | null | undefined, max = 500): string | null {
  if (value == null) return null;
  let s = String(value).replace(CONTROL_RE, "").replace(/\r\n/g, "\n").trim();
  // Neutralize spreadsheet formula injection if stored then re-exported
  if (/^[=+\-@]/.test(s)) {
    s = `'${s}`;
  }
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

const REQUIRED = new Set(["firstName", "lastName", "email", "city", "state"]);

export function sanitizeContactFields<T extends Record<string, unknown>>(contact: T): T {
  const out: Record<string, unknown> = { ...contact };
  for (const [key, max] of Object.entries(MAX_LEN)) {
    if (key in out) {
      const v = out[key];
      if (typeof v === "string" || v == null) {
        const cleaned = sanitizeText(v as string | null, max);
        out[key] = REQUIRED.has(key) ? cleaned ?? "" : cleaned;
      }
    }
  }
  if (typeof out.email === "string") {
    out.email = out.email.toLowerCase();
  }
  if (typeof out.state === "string") {
    out.state = out.state.slice(0, 2).toUpperCase();
  }
  return out as T;
}
