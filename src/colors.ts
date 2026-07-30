/**
 * Color assignment.
 *
 * The eight categorical slots below are the validated set (worst adjacent CVD
 * dE 9.1 light / 8.4 dark). They are assigned in fixed order and never cycled:
 * a 9th entity gets the neutral "Other" gray rather than a generated hue.
 *
 * Crucially, assignment is keyed on a stable sorted list of entity names — not on
 * render order or filter results — so hiding a brand never repaints the ones left
 * on screen.
 */
import type { ColorMode } from './types';

export const CATEGORICAL = [
  { light: '#2a78d6', dark: '#3987e5' }, // blue
  { light: '#eb6834', dark: '#d95926' }, // orange
  { light: '#1baf7a', dark: '#199e70' }, // aqua
  { light: '#eda100', dark: '#c98500' }, // yellow
  { light: '#e87ba4', dark: '#d55181' }, // magenta
  { light: '#008300', dark: '#008300' }, // green
  { light: '#4a3aa7', dark: '#9085e9' }, // violet
  { light: '#e34948', dark: '#e66767' }, // red
] as const;

export const OTHER_GRAY = '#898781';

/** Sequential blue ramp, light -> dark. Used for ZIP saturation (a magnitude). */
const SEQUENTIAL = ['#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export const isDark = (): boolean =>
  document.documentElement.dataset.theme === 'dark'
  || (!document.documentElement.dataset.theme
    && window.matchMedia('(prefers-color-scheme: dark)').matches);

const pick = (slot: number): string => {
  if (slot < 0 || slot >= CATEGORICAL.length) return OTHER_GRAY;
  return isDark() ? CATEGORICAL[slot].dark : CATEGORICAL[slot].light;
};

/**
 * Builds a stable name -> color map. Sorting first means the mapping depends only
 * on the full set of owners in the book, not on what is currently visible.
 */
export function buildOwnerColors(owners: string[]): Map<string, string> {
  const sorted = [...new Set(owners)].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, string>();
  sorted.forEach((owner, i) => map.set(owner, pick(i)));
  return map;
}

/** Saturation: how many territories claim the same ZIP. 1 = uncontested. */
export function saturationColor(count: number): string {
  if (count <= 1) return SEQUENTIAL[0];
  return SEQUENTIAL[Math.min(count - 1, SEQUENTIAL.length - 1)];
}

export const SATURATION_LEGEND = [
  { label: '1 operator', color: SEQUENTIAL[0] },
  { label: '2', color: SEQUENTIAL[1] },
  { label: '3', color: SEQUENTIAL[2] },
  { label: '4', color: SEQUENTIAL[3] },
  { label: '5', color: SEQUENTIAL[4] },
  { label: '6+', color: SEQUENTIAL[5] },
];

export interface ColorContext {
  mode: ColorMode;
  ownerColors: Map<string, string>;
}

export function colorFor(
  props: { brandColor: string; brandColorDark: string; owner: string; metrics: { competitorCount: number } },
  ctx: ColorContext,
): string {
  switch (ctx.mode) {
    case 'brand':
      return isDark() ? props.brandColorDark : props.brandColor;
    case 'owner':
      return ctx.ownerColors.get(props.owner) ?? OTHER_GRAY;
    case 'saturation':
      return saturationColor(props.metrics.competitorCount + 1);
  }
}
