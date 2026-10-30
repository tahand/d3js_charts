import {
  hierarchy,
  select,
  treemap,
  treemapBinary,
  treemapDice,
  treemapSlice,
  treemapSliceDice,
  treemapSquarify,
} from 'd3';
import type { HierarchyRectangularNode } from 'd3';
import { useCallback, useMemo, type ReactNode } from 'react';
import { animate } from '../core/animation';
import { ensureGroup } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat, truncateLabel } from '../core/format';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { BaseChartProps, HierarchyDatum } from '../types';

export type TreemapTile = 'squarify' | 'binary' | 'slice' | 'dice' | 'sliceDice';

const TILES = {
  squarify: treemapSquarify,
  binary: treemapBinary,
  slice: treemapSlice,
  dice: treemapDice,
  sliceDice: treemapSliceDice,
};

export interface TreemapProps extends BaseChartProps {
  data: HierarchyDatum;
  tile?: TreemapTile;
  /** Gap between leaves in px. Defaults to 2. */
  padding?: number;
  /** Show names (and values) inside leaves large enough to hold them. */
  showLabels?: boolean;
  valueFormat?: (value: number) => string;
  onLeafClick?: (leaf: HierarchyDatum, path: string[]) => void;
  onLegendToggle?: (hidden: string[]) => void;
  renderTooltip?: (leaf: HierarchyDatum, path: string[]) => ReactNode;
}

type Node = HierarchyRectangularNode<HierarchyDatum>;

const pathOf = (n: Node) =>
  n
    .ancestors()
    .reverse()
    .slice(1)
    .map((a) => a.data.name);
const groupOf = (n: Node) => (n.depth <= 1 ? n.data.name : n.ancestors()[n.depth - 1].data.name);

/** Treemap coloured by top-level group — https://observablehq.com/@d3/treemap/2 */
export function Treemap(props: TreemapProps) {
  const { data, tile = 'squarify', padding = 2, showLabels = true, valueFormat = defaultNumberFormat, onLeafClick, renderTooltip } = props;
  const keys = useMemo(() => (data.children ?? [data]).map((c) => c.name), [data]);
  const { tooltipApi, hidden, toggle, anim, colorOf } = useChartBase(props, keys);
  const { show, hide } = tooltipApi;

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const filtered: HierarchyDatum = data.children ? { ...data, children: data.children.filter((c) => !hidden.has(c.name)) } : data;
      const root = treemap<HierarchyDatum>()
        .tile(TILES[tile])
        .size([width, height])
        .paddingInner(padding)
        .round(true)(
        hierarchy(filtered)
          .sum((d) => (d.children?.length ? 0 : (d.value ?? 0)))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
      );
      const leaves = root.leaves().filter((l) => (l.value ?? 0) > 0);
      const id = (n: Node) => pathOf(n).join('/');

      const cells = ensureGroup(svg, 'd3c-marks')
        .selectAll<SVGGElement, Node>('g.d3c-leaf')
        .data(leaves, id)
        .join(
          (enter) => {
            const g = enter
              .append('g')
              .attr('class', 'd3c-leaf')
              .attr('transform', (d) => `translate(${(d.x0 + d.x1) / 2},${(d.y0 + d.y1) / 2})`);
            g.append('rect').attr('class', 'd3c-cell').attr('width', 0).attr('height', 0);
            g.append('text').attr('class', 'd3c-leaf-label').attr('x', 6).attr('y', 6);
            return g;
          },
          (update) => update,
          (exit) => animate(exit, anim).style('opacity', 0).remove(),
        )
        .attr('tabindex', 0)
        .attr('aria-label', (d) => `${pathOf(d).join(' / ')}: ${valueFormat(d.value ?? 0)}`)
        .classed('d3c-clickable', !!onLeafClick)
        .on('pointerenter pointermove', (event, d) => {
          const path = pathOf(d);
          show(
            event,
            renderTooltip ? (
              renderTooltip(d.data, path)
            ) : (
              <TooltipContent title={path.join(' / ')} rows={[{ label: 'Value', value: valueFormat(d.value ?? 0), color: colorOf(groupOf(d)) }]} />
            ),
          );
        })
        .on('pointerleave', (event) => hide(event))
        .on('click', (_e, d) => onLeafClick?.(d.data, pathOf(d)));

      animate(cells, anim).attr('transform', (d) => `translate(${d.x0},${d.y0})`);
      animate(cells.select<SVGRectElement>('rect'), anim)
        .attr('width', (d) => d.x1 - d.x0)
        .attr('height', (d) => d.y1 - d.y0)
        .style('fill', (d) => colorOf(groupOf(d)));

      cells.select<SVGTextElement>('text').each(function (d) {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const text = select(this);
        text.selectAll('tspan').remove();
        if (!showLabels || w < 40 || h < 22) return;
        text.append('tspan').attr('x', 6).attr('dy', '1em').text(truncateLabel(d.data.name, w - 12, 11));
        if (h >= 38) {
          text.append('tspan').attr('x', 6).attr('dy', '1.2em').attr('class', 'd3c-leaf-value').text(valueFormat(d.value ?? 0));
        }
      });
    },
    [data, hidden, tile, padding, showLabels, valueFormat, onLeafClick, renderTooltip, anim, colorOf, show, hide],
  );

  const legendItems = useMemo(() => keys.map((k) => ({ key: k, label: k, color: colorOf(k) })), [keys, colorOf]);

  return (
    <ChartContainer {...props} chartType="treemap" tooltipApi={tooltipApi} legendItems={legendItems} hidden={hidden} onToggle={toggle}>
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
