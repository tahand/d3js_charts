import { extent, scaleBand, scaleSequential, select } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { animate } from '../core/animation';
import { drawXAxis, drawYAxis, ensureGroup, estimateTextWidth, resolveMargin } from '../core/axes';
import { ChartContainer, resolveLegend } from '../core/ChartContainer';
import { DEFAULT_SEQUENTIAL } from '../core/colors';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat, truncateLabel } from '../core/format';
import { ColorRampLegend } from '../core/Legend';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { AxisOptions, BaseChartProps } from '../types';

export interface HeatmapDatum {
  x: string;
  y: string;
  value: number;
}

export interface HeatmapProps extends BaseChartProps {
  data: readonly HeatmapDatum[];
  /** Column order. Defaults to first-seen order. */
  xKeys?: readonly string[];
  /** Row order. Defaults to first-seen order. */
  yKeys?: readonly string[];
  /** Colour for t in [0, 1]; e.g. d3.interpolateViridis. Defaults to a light-to-dark blue. */
  colorInterpolator?: (t: number) => string;
  /** Force the colour domain. */
  domain?: [number, number];
  /** Print values inside cells that are large enough. */
  showValues?: boolean;
  /** Gap between cells in px. Defaults to 2. */
  cellGap?: number;
  xAxis?: AxisOptions;
  yAxis?: AxisOptions;
  valueFormat?: (value: number) => string;
  /** Title above the colour ramp. */
  valueLabel?: string;
  onCellClick?: (datum: HeatmapDatum) => void;
  renderTooltip?: (datum: HeatmapDatum) => ReactNode;
}

const uniq = (values: string[]) => [...new Set(values)];

/** Matrix heatmap with a colour-ramp legend. */
export function Heatmap(props: HeatmapProps) {
  const {
    data,
    colorInterpolator = DEFAULT_SEQUENTIAL,
    domain,
    showValues = false,
    cellGap = 2,
    xAxis,
    yAxis,
    valueFormat = defaultNumberFormat,
    valueLabel = 'Value',
    onCellClick,
    renderTooltip,
  } = props;
  const { tooltipApi, anim } = useChartBase(props, []);
  const { show, hide } = tooltipApi;
  const xKeys = useMemo(() => props.xKeys ?? uniq(data.map((d) => d.x)), [props.xKeys, data]);
  const yKeys = useMemo(() => props.yKeys ?? uniq(data.map((d) => d.y)), [props.yKeys, data]);
  const [lo, hi] = useMemo(() => {
    if (domain) return domain;
    const [a = 0, b = 1] = extent(data, (d) => d.value);
    return [a, a === b ? a + 1 : b];
  }, [data, domain]);

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const color = scaleSequential(colorInterpolator).domain([lo, hi]);
      const widestY = Math.max(0, ...yKeys.map((k) => estimateTextWidth(k)));
      const widestX = Math.max(0, ...xKeys.map((k) => estimateTextWidth(k)));
      const left = Math.min(widestY + 12, width * 0.3) + (yAxis?.label ? 18 : 0);
      const step = (width - left - 16) / Math.max(1, xKeys.length);
      const rotate = widestX > step * 0.9;
      const m = resolveMargin(props.margin, {
        top: 8,
        left,
        bottom: (rotate ? Math.min(widestX * 0.7, height * 0.3) + 20 : 32) + (xAxis?.label ? 18 : 0),
      });
      const iw = Math.max(0, width - m.left - m.right);
      const ih = Math.max(0, height - m.top - m.bottom);
      const x = scaleBand<string>().domain(xKeys).range([0, iw]);
      const y = scaleBand<string>().domain(yKeys).range([0, ih]);

      const root = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${m.left},${m.top})`);
      drawXAxis(root, x, { innerWidth: iw, innerHeight: ih, anim, options: xAxis }, { rotateLabels: rotate });
      const maxLabel = left - 10 - (yAxis?.label ? 18 : 0);
      drawYAxis(
        root,
        y,
        { innerWidth: iw, innerHeight: ih, anim, options: { grid: false, tickFormat: (l: string) => truncateLabel(l, maxLabel), ...yAxis } },
        { labelOffset: m.left - 4 },
      );
      root.selectAll('.d3c-axis .domain').remove();

      const cellW = Math.max(0, x.bandwidth() - cellGap);
      const cellH = Math.max(0, y.bandwidth() - cellGap);
      const key = (d: HeatmapDatum) => `${d.x}\u0000${d.y}`;
      const cells = ensureGroup(root, 'd3c-marks')
        .selectAll<SVGRectElement, HeatmapDatum>('rect.d3c-cell')
        .data(data.filter((d) => x(d.x) != null && y(d.y) != null), key)
        .join(
          (enter) => enter.append('rect').attr('class', 'd3c-cell').style('opacity', 0),
          (update) => update,
          (exit) => animate(exit, anim).style('opacity', 0).remove(),
        )
        .attr('x', (d) => x(d.x)! + cellGap / 2)
        .attr('y', (d) => y(d.y)! + cellGap / 2)
        .attr('width', cellW)
        .attr('height', cellH)
        .attr('rx', Math.min(2, cellW / 4))
        .attr('tabindex', 0)
        .attr('aria-label', (d) => `${d.x}, ${d.y}: ${valueFormat(d.value)}`)
        .classed('d3c-clickable', !!onCellClick)
        .on('pointerenter pointermove', (event, d) =>
          show(
            event,
            renderTooltip ? (
              renderTooltip(d)
            ) : (
              <TooltipContent title={`${d.x} · ${d.y}`} rows={[{ label: valueLabel, value: valueFormat(d.value), color: color(d.value) }]} />
            ),
          ),
        )
        .on('pointerleave', (event) => hide(event))
        .on('click', (_e, d) => onCellClick?.(d));
      animate(cells, anim)
        .style('opacity', 1)
        .style('fill', (d) => color(d.value));

      const fits = cellW > 28 && cellH > 16;
      ensureGroup(root, 'd3c-cell-labels')
        .selectAll<SVGTextElement, HeatmapDatum>('text.d3c-cell-label')
        .data(showValues && fits ? data : [], key)
        .join('text')
        .attr('class', 'd3c-cell-label')
        .attr('x', (d) => (x(d.x) ?? 0) + x.bandwidth() / 2)
        .attr('y', (d) => (y(d.y) ?? 0) + y.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        // Light ink on the dark end of the ramp, dark ink on the light end.
        .classed('d3c-cell-label--inverse', (d) => (d.value - lo) / (hi - lo) > 0.55)
        .text((d) => valueFormat(d.value));
    },
    [data, xKeys, yKeys, lo, hi, colorInterpolator, showValues, cellGap, xAxis, yAxis, valueFormat, valueLabel, onCellClick, renderTooltip, props.margin, anim, show, hide],
  );

  const legendOpts = resolveLegend(props.legend, 2);
  const legendNode = legendOpts.show ? (
    <ColorRampLegend
      interpolator={colorInterpolator}
      min={lo}
      max={hi}
      format={valueFormat}
      title={legendOpts.title ?? valueLabel}
      className={legendOpts.className}
      style={legendOpts.style}
    />
  ) : undefined;

  return (
    <ChartContainer {...props} chartType="heatmap" tooltipApi={tooltipApi} legendNode={legendNode}>
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
