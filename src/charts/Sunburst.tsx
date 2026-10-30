import { arc, hierarchy, interpolate, partition, select } from 'd3';
import type { HierarchyRectangularNode } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { isAnimated } from '../core/animation';
import { ensureGroup } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat } from '../core/format';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { BaseChartProps, HierarchyDatum } from '../types';

export interface SunburstProps extends BaseChartProps {
  data: HierarchyDatum;
  /** Number of rings to draw; deeper levels are not shown. Defaults to all. */
  maxDepth?: number;
  /** Label arcs wide enough to hold text. */
  showLabels?: boolean;
  valueFormat?: (value: number) => string;
  onArcClick?: (node: HierarchyDatum, path: string[]) => void;
  onLegendToggle?: (hidden: string[]) => void;
  renderTooltip?: (node: HierarchyDatum, path: string[], value: number) => ReactNode;
}

type Node = HierarchyRectangularNode<HierarchyDatum>;
interface Angles {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
type ArcEl = SVGPathElement & { __current?: Angles };

const pathOf = (n: Node) =>
  n
    .ancestors()
    .reverse()
    .slice(1)
    .map((a) => a.data.name);

/** Sunburst (radial partition) — https://observablehq.com/@d3/sunburst/2 */
export function Sunburst(props: SunburstProps) {
  const { data, maxDepth = Infinity, showLabels = true, valueFormat = defaultNumberFormat, onArcClick, renderTooltip } = props;
  const keys = useMemo(() => (data.children ?? [data]).map((c) => c.name), [data]);
  const { tooltipApi, hidden, toggle, anim, colorOf } = useChartBase(props, keys);
  const { show, hide } = tooltipApi;

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const filtered: HierarchyDatum = data.children ? { ...data, children: data.children.filter((c) => !hidden.has(c.name)) } : data;
      const h = hierarchy(filtered)
        .sum((d) => (d.children?.length ? 0 : (d.value ?? 0)))
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      const depth = Math.max(1, Math.min(maxDepth, h.height));
      const radius = Math.max(0, Math.min(width, height) / 2 - 4);
      const root = partition<HierarchyDatum>().size([2 * Math.PI, h.height + 1])(h);
      const nodes = root.descendants().filter((d) => d.depth > 0 && d.depth <= depth && d.x1 - d.x0 > 0.001);

      const ring = radius / (depth + 1);
      const arcGen = arc<Angles>()
        .startAngle((d) => d.x0)
        .endAngle((d) => d.x1)
        .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius / 2)
        .innerRadius((d) => d.y0 * ring)
        .outerRadius((d) => Math.max(d.y0 * ring, d.y1 * ring - 1))
        .cornerRadius(2);
      const id = (n: Node) => pathOf(n).join('/');
      const top = (n: Node) => n.ancestors()[n.depth - 1].data.name;
      // Inner rings in the full colour; outer rings lighter so the hierarchy reads.
      const opacity = (n: Node) => 1 - ((n.depth - 1) / Math.max(1, depth)) * 0.45;

      const g = ensureGroup(svg, 'd3c-root').attr('transform', `translate(${width / 2},${height / 2})`);
      const paths = ensureGroup(g, 'd3c-marks')
        .selectAll<ArcEl, Node>('path.d3c-arc')
        .data(nodes, id)
        .join(
          (enter) =>
            enter
              .append('path')
              .attr('class', 'd3c-arc')
              .each(function (d) {
                (this as ArcEl).__current = { x0: d.x0, x1: d.x0, y0: d.y0, y1: d.y1 };
              }),
          (update) => update,
          (exit) => exit.remove(),
        )
        .attr('tabindex', 0)
        .attr('aria-label', (d) => `${pathOf(d).join(' / ')}: ${valueFormat(d.value ?? 0)}`)
        .classed('d3c-clickable', !!onArcClick)
        .style('fill', (d) => colorOf(top(d)))
        .style('fill-opacity', opacity)
        .on('pointerenter pointermove', (event, d) => {
          const path = pathOf(d);
          show(
            event,
            renderTooltip ? (
              renderTooltip(d.data, path, d.value ?? 0)
            ) : (
              <TooltipContent
                title={path.join(' / ')}
                rows={[
                  { label: 'Value', value: valueFormat(d.value ?? 0), color: colorOf(top(d)) },
                  { label: 'Share', value: `${(((d.value ?? 0) / (root.value || 1)) * 100).toFixed(1)}%` },
                ]}
              />
            ),
          );
        })
        .on('pointerleave', (event) => hide(event))
        .on('click', (_e, d) => onArcClick?.(d.data, pathOf(d)));

      if (isAnimated(anim)) {
        paths
          .transition()
          .duration(anim.duration)
          .ease(anim.easing)
          .attrTween('d', function (d) {
            const el = this as ArcEl;
            const target = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 };
            const i = interpolate(el.__current ?? target, target);
            el.__current = target;
            return (t) => arcGen(i(t)) ?? '';
          });
      } else {
        paths.attr('d', (d) => arcGen(d) ?? '').each(function (d) {
          (this as ArcEl).__current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 };
        });
      }

      // Labels read along the radius, flipped on the left half so they stay upright.
      const fits = (d: Node) => ((d.y0 + d.y1) / 2) * ring * (d.x1 - d.x0) > 14 && ring > 28;
      ensureGroup(g, 'd3c-arc-labels')
        .selectAll<SVGTextElement, Node>('text.d3c-arc-label')
        .data(showLabels ? nodes.filter(fits) : [], id)
        .join('text')
        .attr('class', 'd3c-arc-label')
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('transform', (d) => {
          const a = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
          const r = ((d.y0 + d.y1) / 2) * ring;
          return `rotate(${a - 90}) translate(${r},0) rotate(${a < 180 ? 0 : 180})`;
        })
        .text((d) => {
          const max = Math.floor((ring - 8) / 6.5);
          return d.data.name.length > max ? `${d.data.name.slice(0, Math.max(1, max - 1))}…` : d.data.name;
        });
    },
    [data, hidden, maxDepth, showLabels, valueFormat, onArcClick, renderTooltip, anim, colorOf, show, hide],
  );

  const legendItems = useMemo(() => keys.map((k) => ({ key: k, label: k, color: colorOf(k) })), [keys, colorOf]);

  return (
    <ChartContainer
      {...props}
      aspectRatio={props.aspectRatio ?? 1.2}
      chartType="sunburst"
      tooltipApi={tooltipApi}
      legendItems={legendItems}
      hidden={hidden}
      onToggle={toggle}
    >
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
