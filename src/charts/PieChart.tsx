import { arc, interpolate, pie, select, sum } from 'd3';
import type { PieArcDatum } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { isAnimated } from '../core/animation';
import { ensureGroup } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat } from '../core/format';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { BaseChartProps } from '../types';

export interface PieDatum {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartProps extends BaseChartProps {
  data: readonly PieDatum[];
  /** Hole size as a fraction of the radius: 0 is a pie, ~0.6 a donut. */
  innerRadius?: number;
  /** Radians between slices. Defaults to 0.01. */
  padAngle?: number;
  cornerRadius?: number;
  /** Text drawn on slices large enough to hold it. */
  labels?: 'none' | 'percent' | 'value' | 'label';
  /** Text in the middle of a donut. Defaults to the formatted total. */
  centerLabel?: string | number | false;
  /** Sort slices by value (largest first) instead of data order. */
  sortByValue?: boolean;
  valueFormat?: (value: number) => string;
  onSliceClick?: (datum: PieDatum, index: number) => void;
  onLegendToggle?: (hidden: string[]) => void;
  renderTooltip?: (datum: PieDatum, percent: number) => ReactNode;
}

type Arc = PieArcDatum<PieDatum>;
type ArcEl = SVGPathElement & { __current?: { startAngle: number; endAngle: number } };

/** Pie and donut charts — https://observablehq.com/@d3/pie-chart/2 */
export function PieChart(props: PieChartProps) {
  const {
    data,
    innerRadius = 0,
    padAngle = 0.01,
    cornerRadius = 2,
    labels = 'percent',
    centerLabel,
    sortByValue = false,
    valueFormat = defaultNumberFormat,
    onSliceClick,
    renderTooltip,
  } = props;
  const keys = useMemo(() => data.map((d) => d.label), [data]);
  const { tooltipApi, hidden, toggle, anim, colorOf } = useChartBase(props, keys);
  const { show, hide } = tooltipApi;
  const colorFor = useCallback((d: PieDatum) => d.color ?? colorOf(d.label), [colorOf]);

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const visible = data.filter((d) => !hidden.has(d.label) && d.value > 0);
      const total = sum(visible, (d) => d.value);
      const radius = Math.max(0, Math.min(width, height) / 2 - 8);
      const inner = radius * Math.max(0, Math.min(0.95, innerRadius));

      const pieGen = pie<PieDatum>()
        .value((d) => d.value)
        .padAngle(padAngle);
      if (sortByValue) pieGen.sort((a, b) => b.value - a.value);
      else pieGen.sort(null);
      const arcs = pieGen(visible);
      const arcGen = arc<{ startAngle: number; endAngle: number; padAngle?: number }>()
        .innerRadius(inner)
        .outerRadius(radius)
        .cornerRadius(cornerRadius);
      const labelArc = arc<Arc>()
        .innerRadius(inner ? (inner + radius) / 2 : radius * 0.62)
        .outerRadius(inner ? (inner + radius) / 2 : radius * 0.62);

      const root = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${width / 2},${height / 2})`);
      const marks = ensureGroup(root, 'd3c-marks');

      // New slices grow from their neighbour's edge; removed ones collapse.
      const previousEnd = (d: Arc) => {
        const i = arcs.indexOf(d);
        return i > 0 ? arcs[i - 1].endAngle : 0;
      };

      const paths = marks
        .selectAll<ArcEl, Arc>('path.d3c-slice')
        .data(arcs, (d) => d.data.label)
        .join(
          (enter) =>
            enter
              .append('path')
              .attr('class', 'd3c-slice')
              .each(function (d) {
                const a = previousEnd(d);
                (this as ArcEl).__current = { startAngle: a, endAngle: a };
              }),
          (update) => update,
          (exit) => {
            if (!isAnimated(anim)) return exit.remove();
            return exit
              .transition()
              .duration(anim.duration)
              .ease(anim.easing)
              .attrTween('d', function () {
                const el = this as ArcEl;
                const from = el.__current ?? { startAngle: 0, endAngle: 0 };
                const i = interpolate(from, { startAngle: from.endAngle, endAngle: from.endAngle });
                return (t) => arcGen(i(t)) ?? '';
              })
              .remove();
          },
        )
        .attr('tabindex', 0)
        .attr('aria-label', (d) => `${d.data.label}: ${valueFormat(d.data.value)}`)
        .classed('d3c-clickable', !!onSliceClick)
        .style('fill', (d) => colorFor(d.data))
        .on('pointerenter pointermove', (event, d) => {
          const pct = total ? d.data.value / total : 0;
          show(
            event,
            renderTooltip ? (
              renderTooltip(d.data, pct)
            ) : (
              <TooltipContent
                title={d.data.label}
                rows={[
                  { label: 'Value', value: valueFormat(d.data.value), color: colorFor(d.data) },
                  { label: 'Share', value: `${(pct * 100).toFixed(1)}%` },
                ]}
              />
            ),
          );
        })
        .on('pointerleave', (event) => hide(event))
        .on('click', (_e, d) => onSliceClick?.(d.data, data.indexOf(d.data)));

      if (isAnimated(anim)) {
        paths
          .transition()
          .duration(anim.duration)
          .delay((_d, i) => anim.delay + i * anim.stagger)
          .ease(anim.easing)
          .attrTween('d', function (d) {
            const el = this as ArcEl;
            const i = interpolate(el.__current ?? { startAngle: d.startAngle, endAngle: d.startAngle }, {
              startAngle: d.startAngle,
              endAngle: d.endAngle,
              padAngle: d.padAngle,
            });
            el.__current = { startAngle: d.startAngle, endAngle: d.endAngle };
            return (t) => arcGen(i(t)) ?? '';
          });
      } else {
        paths.attr('d', (d) => arcGen(d) ?? '').each(function (d) {
          (this as ArcEl).__current = { startAngle: d.startAngle, endAngle: d.endAngle };
        });
      }

      const minAngle = 0.35;
      const labelText = (d: Arc) => {
        if (labels === 'value') return valueFormat(d.data.value);
        if (labels === 'label') return d.data.label;
        return `${Math.round((d.data.value / (total || 1)) * 100)}%`;
      };
      ensureGroup(root, 'd3c-slice-labels')
        .selectAll<SVGTextElement, Arc>('text.d3c-slice-label')
        .data(labels === 'none' ? [] : arcs.filter((d) => d.endAngle - d.startAngle >= minAngle && radius > 60), (d) => d.data.label)
        .join('text')
        .attr('class', 'd3c-slice-label')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
        .text(labelText);

      const center = centerLabel === undefined ? (inner > 30 ? valueFormat(total) : null) : centerLabel;
      ensureGroup(root, 'd3c-center')
        .selectAll<SVGTextElement, string>('text.d3c-center-label')
        .data(center !== false && center != null ? [String(center)] : [])
        .join('text')
        .attr('class', 'd3c-center-label')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .text((d) => d);
    },
    [data, hidden, innerRadius, padAngle, cornerRadius, labels, centerLabel, sortByValue, valueFormat, onSliceClick, renderTooltip, anim, colorFor, show, hide],
  );

  const legendItems = useMemo(() => data.map((d) => ({ key: d.label, label: d.label, color: colorFor(d) })), [data, colorFor]);

  return (
    <ChartContainer
      {...props}
      aspectRatio={props.aspectRatio ?? 1.4}
      chartType={innerRadius > 0 ? 'donut-chart' : 'pie-chart'}
      tooltipApi={tooltipApi}
      legendItems={legendItems}
      hidden={hidden}
      onToggle={toggle}
    >
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}

export type DonutChartProps = PieChartProps;

/** A pie chart with a hole — https://observablehq.com/@d3/donut-chart/2 */
export function DonutChart(props: DonutChartProps) {
  return <PieChart innerRadius={0.6} {...props} />;
}
