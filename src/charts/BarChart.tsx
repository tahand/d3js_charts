import { max, min, scaleBand, scaleLinear, select } from 'd3';
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

export interface BarDatum {
  label: string;
  value: number;
  /** Overrides the series colour for this bar. */
  color?: string;
}

export interface BarChartProps extends BaseChartProps {
  data: readonly BarDatum[];
  orientation?: 'vertical' | 'horizontal';
  sort?: 'none' | 'ascending' | 'descending';
  /** Axis showing the bar labels. */
  categoryAxis?: AxisOptions;
  /** Axis showing the values. */
  valueAxis?: AxisOptions;
  /** Print each value at the end of its bar. */
  showValues?: boolean;
  valueFormat?: (value: number) => string;
  /** Gap between bars as a fraction of the band, 0–1. Defaults to 0.2. */
  padding?: number;
  /** Radius of the rounded data end. Defaults to 4. */
  cornerRadius?: number;
  /** Name of the measure, used for the colour and the tooltip. */
  seriesLabel?: string;
  onBarClick?: (datum: BarDatum, index: number) => void;
  renderTooltip?: (datum: BarDatum) => ReactNode;
}

/** Vertical or horizontal bar chart — https://observablehq.com/@d3/bar-chart */
export function BarChart(props: BarChartProps) {
  const {
    data,
    orientation = 'vertical',
    sort = 'none',
    categoryAxis,
    valueAxis,
    showValues = false,
    valueFormat = defaultNumberFormat,
    padding = 0.2,
    cornerRadius = 4,
    seriesLabel = 'Value',
    onBarClick,
    renderTooltip,
  } = props;
  const { tooltipApi, anim, colorOf } = useChartBase(props, [seriesLabel]);
  const { show, hide } = tooltipApi;

  const sorted = useMemo(() => {
    if (sort === 'none') return [...data];
    const dir = sort === 'ascending' ? 1 : -1;
    return [...data].sort((a, b) => dir * (a.value - b.value));
  }, [data, sort]);

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const vertical = orientation === 'vertical';
      const values = sorted.map((d) => d.value);
      const lo = Math.min(0, min(values) ?? 0, valueAxis?.min ?? 0);
      const hi = Math.max(0, max(values) ?? 0, valueAxis?.max ?? 0);
      const tickFmt = valueAxis?.tickFormat ?? defaultTickFormat;
      const value = scaleLinear().domain([valueAxis?.min ?? lo, valueAxis?.max ?? hi]);
      if (valueAxis?.max == null) value.nice();

      const labels = sorted.map((d) => d.label);
      const widestLabel = Math.max(0, ...labels.map((l) => estimateTextWidth(l)));

      let auto: Parameters<typeof resolveMargin>[1];
      let rotate = false;
      if (vertical) {
        const left = yAxisWidth(value.ticks(5).map((t, i) => tickFmt(t, i)), valueAxis);
        const iw = width - left - 16;
        const step = iw / Math.max(1, labels.length);
        rotate = widestLabel > step * 0.9;
        auto = {
          left,
          top: showValues ? 24 : 16,
          bottom: (rotate ? Math.min(widestLabel * 0.7, height * 0.35) + 20 : 32) + (categoryAxis?.label ? 18 : 0),
        };
      } else {
        auto = {
          left: Math.min(widestLabel + 14, width * 0.35) + (categoryAxis?.label ? 18 : 0),
          right: showValues ? 48 : 16,
          bottom: 32 + (valueAxis?.label ? 18 : 0),
        };
      }
      const m = resolveMargin(props.margin, auto);
      const iw = Math.max(0, width - m.left - m.right);
      const ih = Math.max(0, height - m.top - m.bottom);

      const band = scaleBand<string>()
        .domain(labels)
        .range(vertical ? [0, iw] : [0, ih])
        .padding(padding);
      value.range(vertical ? [ih, 0] : [0, iw]);

      const root = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${m.left},${m.top})`);
      if (vertical) {
        drawXAxis(root, band, { innerWidth: iw, innerHeight: ih, anim, options: categoryAxis }, { rotateLabels: rotate });
        drawYAxis(root, value, { innerWidth: iw, innerHeight: ih, anim, options: { ...valueAxis, tickFormat: tickFmt } }, { labelOffset: m.left - 4 });
      } else {
        const maxLabel = m.left - 10 - (categoryAxis?.label ? 18 : 0);
        drawXAxis(root, value, { innerWidth: iw, innerHeight: ih, anim, options: { grid: true, ...valueAxis, tickFormat: tickFmt } });
        drawYAxis(
          root,
          band,
          {
            innerWidth: iw,
            innerHeight: ih,
            anim,
            options: { grid: false, tickFormat: (l: string) => truncateLabel(l, maxLabel), ...categoryAxis },
          },
          { labelOffset: m.left - 4 },
        );
      }

      const zero = value(0);
      const geometry = (d: BarDatum, atBaseline = false) => {
        const v = atBaseline ? zero : value(d.value);
        const pos = band(d.label) ?? 0;
        if (vertical) {
          const negative = d.value < 0;
          return roundedBarPath(pos, Math.min(v, zero), band.bandwidth(), Math.abs(zero - v), cornerRadius, negative ? 'bottom' : 'top');
        }
        const negative = d.value < 0;
        return roundedBarPath(Math.min(v, zero), pos, Math.abs(v - zero), band.bandwidth(), cornerRadius, negative ? 'left' : 'right');
      };

      const color = colorOf(seriesLabel);
      const marks = ensureGroup(root, 'd3c-marks');
      const bars = marks
        .selectAll<SVGPathElement, BarDatum>('path.d3c-bar')
        .data(sorted, (d) => d.label)
        .join(
          (enter) => enter.append('path').attr('class', 'd3c-bar').attr('d', (d) => geometry(d, true)),
          (update) => update,
          (exit) => animate(exit, anim).attr('d', (d) => geometry(d, true)).remove(),
        )
        .attr('tabindex', 0)
        .attr('aria-label', (d) => `${d.label}: ${valueFormat(d.value)}`)
        .style('fill', (d) => d.color ?? color)
        .classed('d3c-clickable', !!onBarClick)
        .on('pointerenter pointermove', (event, d) =>
          show(event, renderTooltip ? renderTooltip(d) : <TooltipContent title={d.label} rows={[{ label: seriesLabel, value: valueFormat(d.value), color: d.color ?? color }]} />),
        )
        .on('pointerleave', (event) => hide(event))
        .on('click', (_event, d) => onBarClick?.(d, sorted.indexOf(d)));
      animate(bars, anim).attr('d', (d) => geometry(d));

      const labelsG = ensureGroup(root, 'd3c-value-labels');
      const valueLabels = labelsG
        .selectAll<SVGTextElement, BarDatum>('text.d3c-value-label')
        .data(showValues ? sorted : [], (d) => d.label)
        .join((enter) =>
          enter
            .append('text')
            .attr('class', 'd3c-value-label')
            .attr('x', (d) => (vertical ? (band(d.label) ?? 0) + band.bandwidth() / 2 : zero))
            .attr('y', (d) => (vertical ? zero : (band(d.label) ?? 0) + band.bandwidth() / 2)),
        )
        .attr('text-anchor', (d) => (vertical ? 'middle' : d.value < 0 ? 'end' : 'start'))
        .attr('dy', (d) => (vertical ? (d.value < 0 ? '1.1em' : '-0.4em') : '0.35em'))
        .attr('dx', (d) => (vertical ? 0 : d.value < 0 ? -4 : 4))
        .text((d) => valueFormat(d.value));
      animate(valueLabels, anim)
        .attr('x', (d) => (vertical ? (band(d.label) ?? 0) + band.bandwidth() / 2 : value(d.value)))
        .attr('y', (d) => (vertical ? value(d.value) : (band(d.label) ?? 0) + band.bandwidth() / 2));
    },
    [sorted, orientation, categoryAxis, valueAxis, showValues, valueFormat, padding, cornerRadius, seriesLabel, onBarClick, renderTooltip, props.margin, anim, colorOf, show, hide],
  );

  return (
    <ChartContainer {...props} chartType="bar-chart" tooltipApi={tooltipApi}>
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
