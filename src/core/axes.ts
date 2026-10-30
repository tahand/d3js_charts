import { axisBottom, axisLeft, select } from 'd3';
import type { AxisScale, Selection } from 'd3';
import type { AxisOptions, Margin, ResolvedAnimation } from '../types';
import { animate } from './animation';

type G = Selection<SVGGElement, unknown, null, undefined>;

export const DEFAULT_MARGIN: Margin = { top: 16, right: 16, bottom: 32, left: 40 };

export function resolveMargin(margin: Partial<Margin> | undefined, auto: Partial<Margin> = {}): Margin {
  return { ...DEFAULT_MARGIN, ...auto, ...margin };
}

/** Rough text width without touching layout, so it works in jsdom and SSR. */
export function estimateTextWidth(text: string, fontSize = 12): number {
  return text.length * fontSize * 0.6;
}

/** Fewer ticks on small screens: roughly one per `spacing` pixels. */
export function autoTicks(length: number, spacing = 80, opts?: AxisOptions): number {
  return opts?.ticks ?? Math.max(2, Math.floor(length / spacing));
}

/**
 * Returns the `<g>` with the given class under `parent`, creating it on first
 * use. Keeps chart drawing idempotent across re-renders.
 */
export function ensureGroup(parent: Selection<any, any, any, any>, className: string): G {
  let g = parent.select<SVGGElement>(`:scope > g.${className.trim().split(/\s+/).join('.')}`);
  if (g.empty()) g = parent.append('g').attr('class', className);
  return g as unknown as G;
}

interface AxisDrawOptions {
  innerWidth: number;
  innerHeight: number;
  anim: ResolvedAnimation;
  options?: AxisOptions;
}

/** Draws (or updates) a bottom axis plus optional vertical grid lines. */
export function drawXAxis(
  root: G,
  scale: AxisScale<any>,
  { innerWidth, innerHeight, anim, options }: AxisDrawOptions,
  { rotateLabels = false, ticks }: { rotateLabels?: boolean; ticks?: number } = {},
) {
  const grid = ensureGroup(root, 'd3c-grid d3c-grid--x');
  const axisG = ensureGroup(root, 'd3c-axis d3c-axis--x');
  if (options?.hide) {
    axisG.selectAll('*').remove();
    grid.selectAll('*').remove();
    return;
  }
  const count = ticks ?? autoTicks(innerWidth, 80, options);
  const axis = axisBottom(scale).ticks(count).tickSizeOuter(0);
  if (options?.tickFormat) axis.tickFormat(options.tickFormat as any);

  axisG.attr('transform', `translate(0,${innerHeight})`);
  animate(axisG, anim).call(axis as any);
  axisG
    .selectAll<SVGTextElement, unknown>('.tick text')
    .attr('transform', rotateLabels ? 'rotate(-40)' : null)
    .style('text-anchor', () => (rotateLabels ? 'end' : null))
    .attr('dx', rotateLabels ? '-0.4em' : null)
    .attr('dy', rotateLabels ? '0.4em' : '0.71em');

  if (options?.grid) {
    const gridAxis = axisBottom(scale).ticks(count).tickSize(-innerHeight).tickFormat(() => '');
    grid.attr('transform', `translate(0,${innerHeight})`);
    animate(grid, anim).call(gridAxis as any);
    grid.select('.domain').remove();
  } else {
    grid.selectAll('*').remove();
  }
  drawAxisLabel(axisG, options?.label, innerWidth / 2, rotateLabels ? 56 : 30, 0);
}

/** Draws (or updates) a left axis plus optional horizontal grid lines. */
export function drawYAxis(
  root: G,
  scale: AxisScale<any>,
  { innerWidth, innerHeight, anim, options }: AxisDrawOptions,
  { ticks, labelOffset = 36 }: { ticks?: number; labelOffset?: number } = {},
) {
  const grid = ensureGroup(root, 'd3c-grid d3c-grid--y');
  const axisG = ensureGroup(root, 'd3c-axis d3c-axis--y');
  if (options?.hide) {
    axisG.selectAll('*').remove();
    grid.selectAll('*').remove();
    return;
  }
  const count = ticks ?? autoTicks(innerHeight, 50, options);
  const axis = axisLeft(scale).ticks(count).tickSizeOuter(0);
  if (options?.tickFormat) axis.tickFormat(options.tickFormat as any);
  animate(axisG, anim).call(axis as any);

  if (options?.grid ?? true) {
    const gridAxis = axisLeft(scale).ticks(count).tickSize(-innerWidth).tickFormat(() => '');
    animate(grid, anim).call(gridAxis as any);
    grid.select('.domain').remove();
  } else {
    grid.selectAll('*').remove();
  }
  drawAxisLabel(axisG, options?.label, -innerHeight / 2, -labelOffset, -90);
}

function drawAxisLabel(axisG: G, label: string | undefined, x: number, y: number, rotate: number) {
  const text = axisG
    .selectAll<SVGTextElement, string>('text.d3c-axis__label')
    .data(label ? [label] : [])
    .join('text')
    .attr('class', 'd3c-axis__label')
    .attr('text-anchor', 'middle')
    .text((d) => d);
  if (rotate) {
    // Rotated y label sits left of the tick labels, `y` px from the axis line.
    text.attr('transform', `rotate(${rotate})`).attr('x', x).attr('y', y).attr('dy', '0.71em');
  } else {
    text.attr('x', x).attr('y', y).attr('dy', '0.71em');
  }
}

/** Space a y axis needs for its widest tick label (+ optional axis label). */
export function yAxisWidth(tickLabels: string[], options?: AxisOptions): number {
  if (options?.hide) return 8;
  const widest = Math.max(0, ...tickLabels.map((t) => estimateTextWidth(t)));
  return Math.ceil(widest + 14 + (options?.label ? 18 : 0));
}

/** Removes everything the chart drew, e.g. before switching chart modes. */
export function clearSvg(svg: SVGSVGElement | null) {
  if (svg) select(svg).selectAll('*').remove();
}
