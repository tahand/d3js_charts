import type { CSSProperties, ReactNode } from 'react';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

export interface LegendOptions {
  /** Show the legend. Defaults to true when the chart has two or more series. */
  show?: boolean;
  /** Where the legend sits. Left/right collapse to bottom on narrow screens. */
  position?: LegendPosition;
  /** Clicking an item toggles its series on and off. Defaults to true. */
  interactive?: boolean;
  /** Optional heading rendered above the items. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export interface AnimationOptions {
  /** Defaults to true, unless the user prefers reduced motion. */
  enabled?: boolean;
  /** Milliseconds. Defaults to 600. */
  duration?: number;
  /** Milliseconds before the transition starts. Defaults to 0. */
  delay?: number;
  /** Any d3 easing function, e.g. d3.easeBounceOut. Defaults to d3.easeCubicOut. */
  easing?: (t: number) => number;
  /** Extra delay per mark, in ms, for a staggered entrance. Defaults to 0. */
  stagger?: number;
}

export interface ResolvedAnimation {
  enabled: boolean;
  duration: number;
  delay: number;
  easing: (t: number) => number;
  stagger: number;
}

/**
 * Theme values are written to CSS custom properties on the chart root,
 * so they can equally be set from a stylesheet (see styles.css).
 */
export interface ChartTheme {
  fontFamily?: string;
  fontSize?: string;
  textColor?: string;
  mutedTextColor?: string;
  axisColor?: string;
  gridColor?: string;
  background?: string;
  tooltipBackground?: string;
  tooltipColor?: string;
  /** Gap colour drawn between adjacent marks; usually the chart background. */
  markStroke?: string;
}

/** An array of colours (assigned in order) or a function from series key to colour. */
export type ColorInput = readonly string[] | ((key: string, index: number) => string);

export interface AxisOptions {
  label?: string;
  /** Approximate tick count. Defaults to a value based on the chart size. */
  ticks?: number;
  tickFormat?: (value: any, index: number) => string;
  /** Draw grid lines for this axis. */
  grid?: boolean;
  /** Force the domain minimum. */
  min?: number;
  /** Force the domain maximum. */
  max?: number;
  /** Hide the axis entirely. */
  hide?: boolean;
}

export interface BaseChartProps {
  /** Fixed width in px. Omit to fill the parent and resize with it. */
  width?: number;
  /** Fixed height in px. Omit to derive it from `aspectRatio`. */
  height?: number;
  /** width / height when `height` is not set. Defaults to 1.6. */
  aspectRatio?: number;
  /** Minimum height in px when derived from `aspectRatio`. Defaults to 220. */
  minHeight?: number;
  margin?: Partial<Margin>;
  colors?: ColorInput;
  theme?: ChartTheme;
  className?: string;
  style?: CSSProperties;
  /** `false` hides the legend; an object configures it. */
  legend?: boolean | LegendOptions;
  /** `false` disables transitions; an object configures them. */
  animation?: boolean | AnimationOptions;
  /** `false` disables the hover/tap tooltip. */
  tooltip?: boolean;
  /** Visible chart title; also used as the accessible name. */
  title?: ReactNode;
  /** Accessible description of the chart for screen readers. */
  description?: string;
}

export interface LegendItem {
  key: string;
  label: string;
  color: string;
}

export interface ChartSize {
  width: number;
  height: number;
}

/** Nested data for Treemap and Sunburst. Leaves carry `value`; parents sum their children. */
export interface HierarchyDatum {
  name: string;
  value?: number;
  children?: readonly HierarchyDatum[];
}
