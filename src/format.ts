const NA = '—';

export const num = (v: number | null | undefined): string =>
  v == null ? NA : v.toLocaleString('en-US');

export const compact = (v: number | null | undefined): string =>
  v == null ? NA : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

export const usd = (v: number | null | undefined): string =>
  v == null ? NA : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export const pct = (v: number | null | undefined): string =>
  v == null ? NA : `${v.toFixed(1)}%`;

export const sqmi = (v: number | null | undefined): string =>
  v == null ? NA : `${Math.round(v).toLocaleString('en-US')} mi²`;

/** Escapes text before it goes into innerHTML — territory names come from scraped pages. */
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
