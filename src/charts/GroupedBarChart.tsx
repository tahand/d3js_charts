import { max, min, scaleBand, scaleLinear, select, stack, stackOffsetDiverging } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { animate } from '../core/animation';
import { drawXAxis, drawYAxis, ensureGroup, estimateTextWidth, resolveMargin, yAxisWidth } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat, defaultTickFormat, truncateLabel } from '../core/format';
import { roundedBarPath } from '../core/shapes';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { AxisOptions, BaseChartProps } from '../types';

/** One row per category, one numeric column per series — the shape of a CSV. */
export type MultiBarDatum = Record<string, string | number>;

export interface GroupedBarChartProps extends BaseChartProps {
  data: readonly MultiBarDatum[];
  /** Column holding the category label. */
  categoryKey: string;
  /** Series columns, in colour order. Defaults to every numeric column. */
  keys?: readonly string[];
  /** Display names for series keys. */
  seriesLabels?: Readonly<Record<string, string>>;
  /** Side-by-side bars or stacked segments. Defaults to 'grouped'. */
  mode?: 'grouped' | 'stacked';
  orientation?: 'vertical' | 'horizontal';
  categoryAxis?: AxisOptions;
  valueAxis?: AxisOptions;
  valueFormat?: (value: number) => string;
  /** Gap between categories, 0–1. Defaults to 0.2. */
  padding?: number;
  /** Gap between bars inside a group, 0–1. Defaults to 0.08. */
  innerPadding?: number;
  cornerRadius?: number;
  onBarClick?: (row: MultiBarDatum, key: string) => void;
  onLegendToggle?: (hidden: string[]) => void;
  renderTooltip?: (row: MultiBarDatum, key: string) => ReactNode;
}

interface Segment {
  key: string;
  category: string;
  row: MultiBarDatum;
  value: number;
  y0: number;
  y1: number;
  /** Outermost segment of a stack gets the rounded end. */
  outer: boolean;
}

const EMPTY_LABELS: Readonly<Record<string, string>> = {};

function inferKeys(data: readonly MultiBarDatum[], categoryKey: string): string[] {
  const keys = new Set<string>();
  for (const row of data) {
    for (const [k, v] of Object.entries(row)) if (k !== categoryKey && typeof v === 'number') keys.add(k);
  }
  return [...keys];
}

/** Grouped (or stacked) bars — https://observablehq.com/@d3/grouped-bar-chart */
export function GroupedBarChart(props: GroupedBarChartProps) {
  const {
    data,
    categoryKey,
    seriesLabels = EMPTY_LABELS,
    mode = 'grouped',
    orientation = 'vertical',
    categoryAxis,
    valueAxis,
    valueFormat = defaultNumberFormat,
    padding = 0.2,
    innerPadding = 0.08,
    cornerRadius = mode === 'stacked' ? 3 : 4,
    onBarClick,
    renderTooltip,
  } = props;
  const keys = useMemo(() => props.keys ?? inferKeys(data, categoryKey), [props.keys, data, categoryKey]);
  const { tooltipApi, hidden, toggle, anim, colorOf } = useChartBase(props, keys);
  const { show, hide } = tooltipApi;
  const labelOf = useCallback((k: string) => seriesLabels[k] ?? k, [seriesLabels]);

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const vertical = orientation === 'vertical';
      const visibleKeys = keys.filter((k) => !hidden.has(k));
      const categories = data.map((d) => String(d[categoryKey]));
      const num = (row: MultiBarDatum, k: string) => Number(row[k]) || 0;

      let segments: Segment[];
      if (mode === 'stacked') {
        const series = stack<MultiBarDatum>()
          .keys(visibleKeys)
          .value((row, k) => num(row, k))
          .offset(stackOffsetDiverging)(data as MultiBarDatum[]);
        segments = series.flatMap((s) =>
          s.map((p) => ({ key: s.key, category: String(p.data[categoryKey]), row: p.data, value: num(p.data, s.key), y0: p[0], y1: p[1], outer: false })),
        );
        // Mark the outermost positive and negative segment of each stack.
        const outer = new Map<string, Segment>();
        for (const seg of segments) {
          if (seg.value === 0) continue;
          const id = `${seg.category}\u0000${seg.value > 0}`;
          const cur = outer.get(id);
          if (!cur || (seg.value > 0 ? seg.y1 > cur.y1 : seg.y0 < cur.y0)) outer.set(id, seg);
        }
        outer.forEach((seg) => (seg.outer = true));
      } else {
        segments = visibleKeys.flatMap((k) =>
          data.map((row) => ({ key: k, category: String(row[categoryKey]), row, value: num(row, k), y0: 0, y1: num(row, k), outer: true })),
        );
      }

      const lo = Math.min(0, min(segments, (s) => Math.min(s.y0, s.y1)) ?? 0);
      const hi = Math.max(0, max(segments, (s) => Math.max(s.y0, s.y1)) ?? 0);
      const value = scaleLinear().domain([valueAxis?.min ?? lo, valueAxis?.max ?? hi]);
      if (valueAxis?.max == null) value.nice();
      const tickFmt = valueAxis?.tickFormat ?? defaultTickFormat;
      const widestLabel = Math.max(0, ...categories.map((l) => estimateTextWidth(l)));

      let auto: Parameters<typeof resolveMargin>[1];
      let rotate = false;
      if (vertical) {
        const left = yAxisWidth(value.ticks(5).map((t, i) => tickFmt(t, i)), valueAxis);
        const step = (width - left - 16) / Math.max(1, categories.length);
        rotate = widestLabel > step * 0.9;
        auto = { left, bottom: (rotate ? Math.min(widestLabel * 0.7, height * 0.35) + 20 : 32) + (categoryAxis?.label ? 18 : 0) };
      } else {
        auto = { left: Math.min(widestLabel + 14, width * 0.35) + (categoryAxis?.label ? 18 : 0), bottom: 32 + (valueAxis?.label ? 18 : 0) };
      }
      const m = resolveMargin(props.margin, auto);
      const iw = Math.max(0, width - m.left - m.right);
      const ih = Math.max(0, height - m.top - m.bottom);

      const outerBand = scaleBand<string>().domain(categories).range(vertical ? [0, iw] : [0, ih]).padding(padding);
      const innerBand = scaleBand<string>()
        .domain(mode === 'grouped' ? visibleKeys : ['all'])
        .range([0, outerBand.bandwidth()])
        .padding(mode === 'grouped' ? innerPadding : 0);
      value.range(vertical ? [ih, 0] : [0, iw]);

      const root = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${m.left},${m.top})`);
      if (vertical) {
        drawXAxis(root, outerBand, { innerWidth: iw, innerHeight: ih, anim, options: categoryAxis }, { rotateLabels: rotate });
        drawYAxis(root, value, { innerWidth: iw, innerHeight: ih, anim, options: { ...valueAxis, tickFormat: tickFmt } }, { labelOffset: m.left - 4 });
      } else {
        const maxLabel = m.left - 10 - (categoryAxis?.label ? 18 : 0);
        drawXAxis(root, value, { innerWidth: iw, innerHeight: ih, anim, options: { grid: true, ...valueAxis, tickFormat: tickFmt } });
        drawYAxis(
          root,
          outerBand,
          { innerWidth: iw, innerHeight: ih, anim, options: { grid: false, tickFormat: (l: string) => truncateLabel(l, maxLabel), ...categoryAxis } },
          { labelOffset: m.left - 4 },
        );
      }

      const geometry = (s: Segment, collapsed = false) => {
        const pos = (outerBand(s.category) ?? 0) + (innerBand(mode === 'grouped' ? s.key : 'all') ?? 0);
        const thickness = innerBand.bandwidth();
        const a = value(collapsed ? (mode === 'stacked' ? s.y0 : 0) : s.y0);
        const b = value(collapsed ? (mode === 'stacked' ? s.y0 : 0) : s.y1);
        const r = s.outer ? cornerRadius : 0;
        const negative = s.value < 0;
        return vertical
          ? roundedBarPath(pos, Math.min(a, b), thickness, Math.abs(a - b), r, negative ? 'bottom' : 'top')
          : roundedBarPath(Math.min(a, b), pos, Math.abs(a - b), thickness, r, negative ? 'left' : 'right');
      };

      const marks = ensureGroup(root, 'd3c-marks');
      const groups = marks
        .selectAll<SVGGElement, string>('g.d3c-series')
        .data(visibleKeys, (k) => k)
        .join(
          (enter) => enter.append('g').attr('class', 'd3c-series').attr('data-key', (k) => k),
          (update) => update,
          (exit) => {
            animate(exit.selectAll<SVGPathElement, Segment>('path'), anim).attr('d', (s) => geometry(s, true));
            return animate(exit, anim).style('opacity', 0).remove();
          },
        )
        .style('opacity', 1);

      groups.each(function (key) {
        const segs = segments.filter((s) => s.key === key);
        const bars = select(this)
          .selectAll<SVGPathElement, Segment>('path.d3c-bar')
          .data(segs, (s) => s.category)
          .join(
            (enter) => enter.append('path').attr('class', 'd3c-bar').attr('d', (s) => geometry(s, true)),
            (update) => update,
            (exit) => animate(exit, anim).style('opacity', 0).remove(),
          )
          .attr('tabindex', 0)
          .attr('aria-label', (s) => `${s.category}, ${labelOf(s.key)}: ${valueFormat(s.value)}`)
          .style('fill', colorOf(key))
          .classed('d3c-clickable', !!onBarClick)
          .on('pointerenter pointermove', (event, s) =>
            show(
              event,
              renderTooltip ? (
                renderTooltip(s.row, s.key)
              ) : (
                <TooltipContent
                  title={s.category}
                  rows={visibleKeys.map((k) => ({ label: labelOf(k), value: valueFormat(num(s.row, k)), color: colorOf(k) }))}
                />
              ),
            ),
          )
          .on('pointerleave', (event) => hide(event))
          .on('click', (_e, s) => onBarClick?.(s.row, s.key));
        animate(bars, anim).attr('d', (s) => geometry(s));
      });
    },
    [data, categoryKey, keys, hidden, mode, orientation, categoryAxis, valueAxis, valueFormat, padding, innerPadding, cornerRadius, onBarClick, renderTooltip, props.margin, labelOf, anim, colorOf, show, hide],
  );

  const legendItems = useMemo(() => keys.map((k) => ({ key: k, label: labelOf(k), color: colorOf(k) })), [keys, labelOf, colorOf]);

  return (
    <ChartContainer
      {...props}
      chartType={mode === 'stacked' ? 'stacked-bar-chart' : 'grouped-bar-chart'}
      tooltipApi={tooltipApi}
      legendItems={legendItems}
      hidden={hidden}
      onToggle={toggle}
    >
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}

export type StackedBarChartProps = Omit<GroupedBarChartProps, 'mode'>;

/** Stacked bars — https://observablehq.com/@d3/stacked-bar-chart/2 */
export function StackedBarChart(props: StackedBarChartProps) {
  return <GroupedBarChart {...props} mode="stacked" />;
}
