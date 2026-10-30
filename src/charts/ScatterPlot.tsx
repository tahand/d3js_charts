import { extent, max, scaleLinear, scaleSqrt, select } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { animate } from '../core/animation';
import { drawXAxis, drawYAxis, ensureGroup, resolveMargin, yAxisWidth } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat, defaultTickFormat } from '../core/format';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { AxisOptions, BaseChartProps } from '../types';

export interface ScatterPoint {
  x: number;
  y: number;
  /** Encoded as circle area when present — makes a bubble chart. */
  size?: number;
  /** Name shown in the tooltip. */
  label?: string;
}

export interface ScatterSeries {
  key: string;
  label?: string;
  color?: string;
  data: readonly ScatterPoint[];
}

export interface ScatterPlotProps extends BaseChartProps {
  series: readonly ScatterSeries[];
  xAxis?: AxisOptions;
  yAxis?: AxisOptions;
  /** Radius for points without `size`. Defaults to 5. */
  pointRadius?: number;
  /** Min/max radius when points carry `size`. Defaults to [4, 28]. */
  sizeRange?: [number, number];
  /** Formats the `size` value in tooltips. */
  sizeFormat?: (value: number) => string;
  /** Label for the `size` value in tooltips. Defaults to "Size". */
  sizeLabel?: string;
  /** Write each point's label beside it. */
  showLabels?: boolean;
  valueFormat?: (value: number) => string;
  onPointClick?: (point: ScatterPoint, seriesKey: string) => void;
  onLegendToggle?: (hidden: string[]) => void;
  renderTooltip?: (point: ScatterPoint, seriesKey: string) => ReactNode;
}

interface Dot extends ScatterPoint {
  key: string;
  id: string;
}

/** Scatterplot and bubble chart — https://observablehq.com/@d3/scatterplot/2 */
export function ScatterPlot(props: ScatterPlotProps) {
  const {
    series,
    xAxis,
    yAxis,
    pointRadius = 5,
    sizeRange = [4, 28],
    sizeFormat = defaultNumberFormat,
    sizeLabel = 'Size',
    showLabels = false,
    valueFormat = defaultNumberFormat,
    onPointClick,
    renderTooltip,
  } = props;
  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const { tooltipApi, hidden, toggle, anim, colorOf } = useChartBase(props, keys);
  const { show, hide } = tooltipApi;
  const colorFor = useCallback((key: string) => series.find((s) => s.key === key)?.color ?? colorOf(key), [series, colorOf]);
  const labelFor = useCallback((key: string) => series.find((s) => s.key === key)?.label ?? key, [series]);
  const [rMin, rMax] = sizeRange;

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      // Domains use every series, so toggling one doesn't rescale the others.
      const everything = series.flatMap((s) => s.data);
      const dots: Dot[] = series
        .filter((s) => !hidden.has(s.key))
        .flatMap((s) => s.data.map((p, i) => ({ ...p, key: s.key, id: `${s.key}\u0000${p.label ?? i}` })));

      const [xLo = 0, xHi = 1] = extent(everything, (p) => p.x);
      const [yLo = 0, yHi = 1] = extent(everything, (p) => p.y);
      const y = scaleLinear().domain([yAxis?.min ?? yLo, yAxis?.max ?? yHi]);
      if (yAxis?.min == null && yAxis?.max == null) y.nice();
      const yTickFmt = yAxis?.tickFormat ?? defaultTickFormat;
      const maxSize = max(everything, (p) => p.size ?? 0) ?? 0;
      const r = scaleSqrt().domain([0, maxSize || 1]).range([rMin, rMax]);
      const radius = (p: ScatterPoint) => (p.size != null && maxSize > 0 ? r(p.size) : pointRadius);
      const pad = maxSize > 0 ? rMax : pointRadius + 2;

      const m = resolveMargin(props.margin, {
        top: Math.max(16, pad),
        right: Math.max(16, pad),
        left: yAxisWidth(y.ticks(5).map((t, i) => yTickFmt(t, i)), yAxis),
        bottom: 32 + (xAxis?.label ? 18 : 0),
      });
      const iw = Math.max(0, width - m.left - m.right);
      const ih = Math.max(0, height - m.top - m.bottom);
      y.range([ih, 0]);
      const x = scaleLinear().domain([xAxis?.min ?? xLo, xAxis?.max ?? xHi]).range([0, iw]);
      if (xAxis?.min == null && xAxis?.max == null) x.nice();

      const root = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${m.left},${m.top})`);
      drawXAxis(root, x, { innerWidth: iw, innerHeight: ih, anim, options: { grid: true, tickFormat: defaultTickFormat, ...xAxis } });
      drawYAxis(root, y, { innerWidth: iw, innerHeight: ih, anim, options: { ...yAxis, tickFormat: yTickFmt } }, { labelOffset: m.left - 4 });

      const marks = ensureGroup(root, 'd3c-marks');
      // Draw large bubbles first so small ones stay on top and hoverable.
      const ordered = [...dots].sort((a, b) => radius(b) - radius(a));
      const circles = marks
        .selectAll<SVGCircleElement, Dot>('circle.d3c-dot')
        .data(ordered, (d) => d.id)
        .join(
          (enter) =>
            enter
              .append('circle')
              .attr('class', 'd3c-dot')
              .attr('r', 0)
              .attr('cx', (d) => x(d.x))
              .attr('cy', (d) => y(d.y)),
          (update) => update,
          (exit) => animate(exit, anim).attr('r', 0).remove(),
        )
        .order()
        .attr('tabindex', 0)
        .attr('aria-label', (d) => `${d.label ? `${d.label}, ` : ''}${labelFor(d.key)}: x ${valueFormat(d.x)}, y ${valueFormat(d.y)}`)
        .classed('d3c-clickable', !!onPointClick)
        .style('fill', (d) => colorFor(d.key))
        .on('pointerenter pointermove', (event, d) => {
          const rows = [
            { label: xAxis?.label ?? 'x', value: valueFormat(d.x), color: colorFor(d.key) },
            { label: yAxis?.label ?? 'y', value: valueFormat(d.y) },
          ];
          if (d.size != null) rows.push({ label: sizeLabel, value: sizeFormat(d.size) });
          show(event, renderTooltip ? renderTooltip(d, d.key) : <TooltipContent title={d.label ?? labelFor(d.key)} rows={rows} />);
        })
        .on('pointerleave', (event) => hide(event))
        .on('click', (_e, d) => onPointClick?.(d, d.key));
      animate(circles, anim)
        .attr('cx', (d) => x(d.x))
        .attr('cy', (d) => y(d.y))
        .attr('r', radius);

      ensureGroup(root, 'd3c-point-labels')
        .selectAll<SVGTextElement, Dot>('text.d3c-point-label')
        .data(showLabels ? dots.filter((d) => d.label) : [], (d) => d.id)
        .join('text')
        .attr('class', 'd3c-point-label')
        .attr('x', (d) => x(d.x) + radius(d) + 3)
        .attr('y', (d) => y(d.y))
        .attr('dy', '0.35em')
        .text((d) => d.label!);
    },
    [series, hidden, xAxis, yAxis, pointRadius, rMin, rMax, sizeFormat, sizeLabel, showLabels, valueFormat, onPointClick, renderTooltip, props.margin, anim, colorFor, labelFor, show, hide],
  );

  const legendItems = useMemo(() => series.map((s) => ({ key: s.key, label: labelFor(s.key), color: colorFor(s.key) })), [series, labelFor, colorFor]);

  return (
    <ChartContainer
      {...props}
      chartType="scatter-plot"
      tooltipApi={tooltipApi}
      legendItems={legendItems}
      hidden={hidden}
      onToggle={toggle}
    >
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
