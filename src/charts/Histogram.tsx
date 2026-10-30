import { bin, extent, max, scaleLinear, select } from 'd3';
import type { Bin } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { animate } from '../core/animation';
import { drawXAxis, drawYAxis, ensureGroup, resolveMargin, yAxisWidth } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat, defaultTickFormat } from '../core/format';
import { roundedBarPath } from '../core/shapes';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { AxisOptions, BaseChartProps } from '../types';

export interface HistogramProps extends BaseChartProps {
  /** Raw observations; they are binned for you. */
  data: readonly number[];
  /** Approximate number of bins, or explicit bin edges. Defaults to d3's Sturges rule. */
  thresholds?: number | readonly number[];
  xAxis?: AxisOptions;
  yAxis?: AxisOptions;
  /** Name of the measure, used in tooltips. */
  seriesLabel?: string;
  valueFormat?: (value: number) => string;
  cornerRadius?: number;
  onBinClick?: (bin: { x0: number; x1: number; count: number; values: number[] }) => void;
  renderTooltip?: (bin: { x0: number; x1: number; count: number }) => ReactNode;
}

type NumBin = Bin<number, number>;

/** Histogram — https://observablehq.com/@d3/histogram/2 */
export function Histogram(props: HistogramProps) {
  const {
    data,
    thresholds,
    xAxis,
    yAxis,
    seriesLabel = 'Count',
    valueFormat = defaultNumberFormat,
    cornerRadius = 3,
    onBinClick,
    renderTooltip,
  } = props;
  const { tooltipApi, anim, colorOf } = useChartBase(props, [seriesLabel]);
  const { show, hide } = tooltipApi;

  const bins = useMemo(() => {
    // Explicit bin edges widen the domain so no bin is clipped.
    const edges = Array.isArray(thresholds) ? (thresholds as number[]) : [];
    const [lo = 0, hi = 1] = extent([...data, ...edges]);
    const x = scaleLinear().domain([xAxis?.min ?? lo, xAxis?.max ?? hi]);
    if (!edges.length) x.nice();
    const binner = bin<number, number>().domain(x.domain() as [number, number]);
    if (typeof thresholds === 'number') binner.thresholds(x.ticks(thresholds));
    // Edges on the domain boundary would create empty zero-width bins.
    else if (edges.length) binner.thresholds(edges.filter((t) => t > x.domain()[0] && t < x.domain()[1]));
    return binner(data as number[]);
  }, [data, thresholds, xAxis?.min, xAxis?.max]);

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const y = scaleLinear().domain([0, yAxis?.max ?? max(bins, (b) => b.length) ?? 1]);
      if (yAxis?.max == null) y.nice();
      const yTickFmt = yAxis?.tickFormat ?? defaultTickFormat;
      const m = resolveMargin(props.margin, {
        left: yAxisWidth(y.ticks(5).map((t, i) => yTickFmt(t, i)), yAxis),
        bottom: 32 + (xAxis?.label ? 18 : 0),
      });
      const iw = Math.max(0, width - m.left - m.right);
      const ih = Math.max(0, height - m.top - m.bottom);
      y.range([ih, 0]);
      const x = scaleLinear()
        .domain([bins[0]?.x0 ?? 0, bins[bins.length - 1]?.x1 ?? 1])
        .range([0, iw]);

      const root = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${m.left},${m.top})`);
      drawXAxis(root, x, { innerWidth: iw, innerHeight: ih, anim, options: { tickFormat: defaultTickFormat, ...xAxis } });
      drawYAxis(root, y, { innerWidth: iw, innerHeight: ih, anim, options: { ...yAxis, tickFormat: yTickFmt } }, { labelOffset: m.left - 4 });

      const gap = 1;
      const geometry = (b: NumBin, flat = false) => {
        const x0 = x(b.x0!) + gap;
        const w = Math.max(0, x(b.x1!) - x(b.x0!) - gap * 2);
        const top = flat ? ih : y(b.length);
        return roundedBarPath(x0, top, w, ih - top, cornerRadius, 'top');
      };
      const color = colorOf(seriesLabel);
      const bars = ensureGroup(root, 'd3c-marks')
        .selectAll<SVGPathElement, NumBin>('path.d3c-bar')
        .data(bins, (b) => `${b.x0}-${b.x1}`)
        .join(
          (enter) => enter.append('path').attr('class', 'd3c-bar').attr('d', (b) => geometry(b, true)),
          (update) => update,
          (exit) => animate(exit, anim).style('opacity', 0).remove(),
        )
        .attr('tabindex', 0)
        .attr('aria-label', (b) => `${valueFormat(b.x0!)} to ${valueFormat(b.x1!)}: ${b.length}`)
        .classed('d3c-clickable', !!onBinClick)
        .style('fill', color)
        .on('pointerenter pointermove', (event, b) => {
          const info = { x0: b.x0!, x1: b.x1!, count: b.length };
          show(
            event,
            renderTooltip ? (
              renderTooltip(info)
            ) : (
              <TooltipContent title={`${valueFormat(info.x0)} – ${valueFormat(info.x1)}`} rows={[{ label: seriesLabel, value: valueFormat(info.count), color }]} />
            ),
          );
        })
        .on('pointerleave', (event) => hide(event))
        .on('click', (_e, b) => onBinClick?.({ x0: b.x0!, x1: b.x1!, count: b.length, values: [...b] }));
      animate(bars, anim).attr('d', (b) => geometry(b));
    },
    [bins, xAxis, yAxis, seriesLabel, valueFormat, cornerRadius, onBinClick, renderTooltip, props.margin, anim, colorOf, show, hide],
  );

  return (
    <ChartContainer {...props} chartType="histogram" tooltipApi={tooltipApi}>
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
