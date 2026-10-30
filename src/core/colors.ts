import { interpolateRgb } from 'd3';
import type { ColorInput } from '../types';

/**
 * Default categorical palette, assigned in fixed order. Each entry reads a CSS
 * variable so dark mode (and user stylesheets) can restyle it, with a light-mode
 * fallback for when styles.css isn't loaded.
 */
export const DEFAULT_COLORS: readonly string[] = [
  'var(--d3c-series-1, #2a78d6)',
  'var(--d3c-series-2, #eb6834)',
  'var(--d3c-series-3, #1baf7a)',
  'var(--d3c-series-4, #eda100)',
  'var(--d3c-series-5, #e87ba4)',
  'var(--d3c-series-6, #008300)',
  'var(--d3c-series-7, #6250d6)',
  'var(--d3c-series-8, #e34948)',
];

/** Plain hex values of the default palette, for places that need a real colour. */
export const DEFAULT_HEX_COLORS: readonly string[] = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];

/** Light-to-dark single-hue ramp used for sequential (magnitude) encodings. */
export const DEFAULT_SEQUENTIAL = interpolateRgb('#cde2fb', '#0d366b');

/**
 * Build a stable key -> colour lookup. Colours follow the series key, not its
 * position among the visible series, so hiding a series never repaints the rest.
 */
export function createColorScale(
  keys: readonly string[],
  colors: ColorInput = DEFAULT_COLORS,
): (key: string) => string {
  const index = new Map(keys.map((k, i) => [k, i]));
  return (key: string) => {
    let i = index.get(key);
    if (i === undefined) {
      i = index.size;
      index.set(key, i);
    }
    if (typeof colors === 'function') return colors(key, i);
    const palette = colors.length ? colors : DEFAULT_COLORS;
    return palette[i % palette.length];
  };
}
