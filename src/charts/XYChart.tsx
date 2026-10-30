import {
  area,
  bisectCenter,
  curveBasis,
  curveCardinal,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStepAfter,
  line,
  max,
  min,
  pointer,
  scaleLinear,
  scaleTime,
  select,
  stack,
  stackOffsetNone,
} from 'd3';
import type { CurveFactory } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { animate } from '../core/animation';
import { drawXAxis, drawYAxis, ensureGroup, resolveMargin, yAxisWidth } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat, defaultTickFormat, formatDate } from '../core/format';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { AxisOptions, BaseChartProps } from '../types';

export interface XYPoint {
  x: number | Date;
  y: number;
}

export interface XYSeries {
  key: string;
  label?: string;
  /** Overrides the palette colour for this series. */
  color?: string;
  data: readonly XYPoint[];
}

export type CurveType = 'linear' | 'monotone' | 'step' | 'natural' | 'basis' | 'cardinal';

const CURVES: Record<CurveType, CurveFactory> = {
  linear: curveLinear,
  monotone: curveMonotoneX,
  step: curveStepAfter,
  natural: curveNatural,
  basis: curveBasis,
  cardinal: curveCardinal,
};

export interface XYChartProps extends BaseChartProps {
  series: readonly XYSeries[];
  curve?: CurveType;
  xAxis?: AxisOptions;
  yAxis?: AxisOptions;
  /** Formats y values in tooltips. */
  valueFormat?: (value: number) => string;
  /** Formats x values in the tooltip heading. */
  xFormat?: (value: number | Date) => string;
  /** Draw a dot on every data point. */
  showPoints?: boolean;
  /** Start the y axis at zero. Defaults to true for areas, false for lines. */
  includeZero?: boolean;
  onLegendToggle?: (hidden: string[]) => void;
  /** Called with the hovered x and each visible series' value at that x. */
  renderTooltip?: (x: number | Date, values: { key: string; label: string; value: number; color: string }[]) => ReactNode;
}

interface InternalProps extends XYChartProps {
  variant: 'line' | 'area';
  stacked?: boolean;
}

interface PlotPoint {
  x: number;
  y: number;
  y0: number;
  y1: number;
}

interface PlotSeries {
  key: string;
  points: PlotPoint[];
}

const toNum = (x: number | Date) => (x instanceof Date ? x.getTime() : x);

export function XYChart(props: InternalProps) {
  const {
    series,
    variant,
    stacked = false,
    curve = 'monotone',
    xAxis,
    yAxis,
    valueFormat = defaultNumberFormat,
    showPoints = false,
    includeZero = variant === 'area',
    renderTooltip,
  } = props;
  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const { tooltipApi, hidden, toggle, anim, colorOf } = useChartBase(props, keys);
  const { show, hide } = tooltipApi;
  const isTime = series.some((s) => s.data[0]?.x instanceof Date);
  const xFormat = props.xFormat ?? ((v: number | Date) => (v instanceof Date ? formatDate(v) : defaultNumberFormat(v)));

  const colorFor = useCallback((key: string) => series.find((s) => s.key === key)?.color ?? colorOf(key), [series, colorOf]);
  const labelFor = useCallback((key: string) => series.find((s) => s.key === key)?.label ?? key, [series]);

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const visible = series.filter((s) => !hidden.has(s.key));

      let plot: PlotSeries[];
      if (stacked) {
        const xs = [...new Set(visible.flatMap((s) => s.data.map((p) => toNum(p.x))))].sort((a, b) => a - b);
        const rows = xs.map((x) => {
          const row: Record<string, number> = { x };
          for (const s of visible) row[s.key] = 0;
          return row;
        });
        const index = new Map(xs.map((x, i) => [x, i]));
        for (const s of visible) for (const p of s.data) rows[index.get(toNum(p.x))!][s.key] += p.y;
        const stacks = stack<Record<string, number>>().keys(visible.map((s) => s.key)).offset(stackOffsetNone)(rows);
        plot = stacks.map((st) => ({
          key: st.key,
          points: st.map((p) => ({ x: p.data.x, y: p.data[st.key], y0: p[0], y1: p[1] })),
        }));
      } else {
        plot = visible.map((s) => ({
          key: s.key,
          points: [...s.data]
            .map((p) => ({ x: toNum(p.x), y: p.y, y0: 0, y1: p.y }))
            .sort((a, b) => a.x - b.x),
        }));
      }

      const all = plot.flatMap((s) => s.points);
      const xMin = min(all, (p) => p.x) ?? 0;
      const xMax = max(all, (p) => p.x) ?? 1;
      // Unstacked series have y0 = 0 as a placeholder; only stacks use it.
      let yLo = min(all, (p) => (stacked ? Math.min(p.y0, p.y1) : p.y1)) ?? 0;
      let yHi = max(all, (p) => p.y1) ?? 1;
      if (includeZero) {
        yLo = Math.min(0, yLo);
        yHi = Math.max(0, yHi);
      }
      if (yLo === yHi) yHi = yLo + 1;
      const y = scaleLinear().domain([yAxis?.min ?? yLo, yAxis?.max ?? yHi]);
      if (yAxis?.min == null && yAxis?.max == null) y.nice();
      const yTickFmt = yAxis?.tickFormat ?? defaultTickFormat;

      const m = resolveMargin(props.margin, {
        left: yAxisWidth(y.ticks(5).map((t, i) => yTickFmt(t, i)), yAxis),
        right: 20,
        bottom: 32 + (xAxis?.label ? 18 : 0),
      });
      const iw = Math.max(0, width - m.left - m.right);
      const ih = Math.max(0, height - m.top - m.bottom);
      y.range([ih, 0]);
      const x = isTime
        ? scaleTime().domain([new Date(xAxis?.min ?? xMin), new Date(xAxis?.max ?? xMax)]).range([0, iw])
        : scaleLinear().domain([xAxis?.min ?? xMin, xAxis?.max ?? xMax]).range([0, iw]);
      const xPos = (v: number) => (isTime ? x(new Date(v)) : x(v));

      const root = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${m.left},${m.top})`);
      drawXAxis(root, x as any, { innerWidth: iw, innerHeight: ih, anim, options: xAxis });
      drawYAxis(root, y, { innerWidth: iw, innerHeight: ih, anim, options: { ...yAxis, tickFormat: yTickFmt } }, { labelOffset: m.left - 4 });

      const baseline = y(Math.max(y.domain()[0], Math.min(0, y.domain()[1])));
      const curveFactory = CURVES[curve];
      const lineGen = (flat: boolean) =>
        line<PlotPoint>()
          .x((p) => xPos(p.x))
          .y((p) => (flat ? baseline : y(p.y1)))
          .curve(curveFactory);
      const areaGen = (flat: boolean) =>
        area<PlotPoint>()
          .x((p) => xPos(p.x))
          .y0((p) => (flat ? baseline : stacked ? y(p.y0) : baseline))
          .y1((p) => (flat ? baseline : y(p.y1)))
          .curve(curveFactory);

      const marks = ensureGroup(root, 'd3c-marks');
      const groups = marks
        .selectAll<SVGGElement, PlotSeries>('g.d3c-series')
        .data(plot, (s) => s.key)
        .join(
          (enter) => {
            const g = enter.append('g').attr('class', 'd3c-series').attr('data-key', (s) => s.key);
            if (variant === 'area') g.append('path').attr('class', 'd3c-area').attr('d', (s) => areaGen(true)(s.points));
            g.append('path').attr('class', 'd3c-line').attr('d', (s) => lineGen(true)(s.points));
            return g;
          },
          (update) => update,
          (exit) => {
            animate(exit.select<SVGPathElement>('.d3c-area'), anim).attr('d', (s) => areaGen(true)(s.points));
            animate(exit.select<SVGPathElement>('.d3c-line'), anim).attr('d', (s) => lineGen(true)(s.points));
            return animate(exit, anim).style('opacity', 0).remove();
          },
        );

      groups.each(function (s) {
        const g = select(this);
        const color = colorFor(s.key);
        animate(g.select<SVGPathElement>('.d3c-area').datum(s), anim)
          .style('fill', color)
          .attr('d', areaGen(false)(s.points));
        animate(g.select<SVGPathElement>('.d3c-line').datum(s), anim)
          .style('stroke', color)
          .attr('d', lineGen(false)(s.points));
        const dots = g
          .selectAll<SVGCircleElement, PlotPoint>('circle.d3c-point')
          .data(showPoints ? s.points : [], (p) => p.x)
          .join((enter) => enter.append('circle').attr('class', 'd3c-point').attr('r', 0).attr('cx', (p) => xPos(p.x)).attr('cy', baseline))
          .style('fill', color);
        animate(dots, anim)
          .attr('r', 4)
          .attr('cx', (p) => xPos(p.x))
          .attr('cy', (p) => y(p.y1));
      });

      // Crosshair + tooltip: snap to the nearest x present in any visible series.
      const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
      const hover = ensureGroup(root, 'd3c-hover').style('display', 'none');
      const rule = hover
        .selectAll('line.d3c-crosshair')
        .data([0])
        .join('line')
        .attr('class', 'd3c-crosshair')
        .attr('y1', 0)
        .attr('y2', ih);

      const overlay = root
        .selectAll<SVGRectElement, number>('rect.d3c-overlay')
        .data([0])
        .join('rect')
        .attr('class', 'd3c-overlay')
        .attr('width', iw)
        .attr('height', ih)
        .style('fill', 'transparent');

      overlay
        .on('pointerenter pointermove', (event) => {
          if (!xs.length) return;
          const [mx] = pointer(event, overlay.node());
          const target = isTime ? (x.invert(mx) as Date).getTime() : (x.invert(mx) as number);
          const nearest = xs[bisectCenter(xs, target)];
          const cx = xPos(nearest);
          hover.style('display', null);
          rule.attr('x1', cx).attr('x2', cx);
          const hits = plot
            .map((s) => ({ s, p: s.points.find((p) => p.x === nearest) }))
            .filter((h): h is { s: PlotSeries; p: PlotPoint } => !!h.p);
          hover
            .selectAll<SVGCircleElement, { s: PlotSeries; p: PlotPoint }>('circle.d3c-hover-dot')
            .data(hits, (h) => h.s.key)
            .join('circle')
            .attr('class', 'd3c-hover-dot')
            .attr('r', 5)
            .attr('cx', cx)
            .attr('cy', (h) => y(h.p.y1))
            .style('fill', (h) => colorFor(h.s.key));
          const xValue = isTime ? new Date(nearest) : nearest;
          const values = hits.map((h) => ({ key: h.s.key, label: labelFor(h.s.key), value: h.p.y, color: colorFor(h.s.key) }));
          show(
            event,
            renderTooltip ? (
              renderTooltip(xValue, values)
            ) : (
              <TooltipContent title={xFormat(xValue)} rows={values.map((v) => ({ label: v.label, value: valueFormat(v.value), color: v.color }))} />
            ),
          );
        })
        .on('pointerleave', (event) => {
          if ((event as PointerEvent).pointerType !== 'touch') hover.style('display', 'none');
          hide(event);
        });
    },
    // xFormat is derived from props.xFormat each render; depend on the prop instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, hidden, stacked, variant, curve, xAxis, yAxis, valueFormat, props.xFormat, showPoints, includeZero, renderTooltip, props.margin, isTime, anim, colorFor, labelFor, show, hide],
  );

  const legendItems = useMemo(() => series.map((s) => ({ key: s.key, label: labelFor(s.key), color: colorFor(s.key) })), [series, labelFor, colorFor]);

  return (
    <ChartContainer
      {...props}
      chartType={variant === 'area' ? 'area-chart' : 'line-chart'}
      tooltipApi={tooltipApi}
      legendItems={legendItems}
      hidden={hidden}
      onToggle={toggle}
    >
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
