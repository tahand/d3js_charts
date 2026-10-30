import { drag, forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, scaleSqrt, select, zoom } from 'd3';
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { isAnimated } from '../core/animation';
import { ensureGroup } from '../core/axes';
import { ChartContainer } from '../core/ChartContainer';
import { D3Svg, type DrawFn } from '../core/D3Svg';
import { defaultNumberFormat } from '../core/format';
import { TooltipContent } from '../core/TooltipContent';
import { useChartBase } from '../core/useChartBase';
import type { BaseChartProps } from '../types';

export interface GraphNode {
  id: string;
  label?: string;
  /** Nodes are coloured and toggled by group. */
  group?: string;
  /** Encoded as node area. */
  size?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  /** Encoded as link width. */
  value?: number;
}

export interface ForceGraphProps extends BaseChartProps {
  nodes: readonly GraphNode[];
  links: readonly GraphLink[];
  /** Radius for nodes without `size`. Defaults to 6. */
  nodeRadius?: number;
  /** Radius range when nodes carry `size`. Defaults to [4, 18]. */
  sizeRange?: [number, number];
  /** Target link length in px. Defaults to 40. */
  linkDistance?: number;
  /** Node repulsion; more negative spreads the graph. Defaults to -60. */
  chargeStrength?: number;
  /** Drag nodes with mouse or touch. Defaults to true. */
  draggable?: boolean;
  /** Pinch / wheel zoom and pan. Off by default so the page still scrolls on touch. */
  zoomable?: boolean;
  /** Write node labels beside the nodes. */
  showLabels?: boolean;
  onNodeClick?: (node: GraphNode) => void;
  onLegendToggle?: (hidden: string[]) => void;
  renderTooltip?: (node: GraphNode, degree: number) => ReactNode;
}

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { value?: number };

const groupKey = (n: GraphNode) => n.group ?? 'default';

/** Force-directed graph — https://observablehq.com/@d3/force-directed-graph/2 */
export function ForceGraph(props: ForceGraphProps) {
  const {
    nodes,
    links,
    nodeRadius = 6,
    sizeRange = [4, 18],
    linkDistance = 40,
    chargeStrength = -60,
    draggable = true,
    zoomable = false,
    showLabels = false,
    onNodeClick,
    renderTooltip,
  } = props;
  const keys = useMemo(() => [...new Set(nodes.map(groupKey))], [nodes]);
  const { tooltipApi, hidden, toggle, anim, colorOf } = useChartBase(props, keys);
  const { show, hide } = tooltipApi;
  // Positions survive redraws (resize, legend toggles) so the layout doesn't restart from scratch.
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const [rMin, rMax] = sizeRange;

  const draw = useCallback<DrawFn>(
    (svgEl, { width, height }) => {
      const svg = select(svgEl);
      const simNodes: SimNode[] = nodes
        .filter((n) => !hidden.has(groupKey(n)))
        .map((n) => ({ ...n, ...positions.current.get(n.id) }));
      const ids = new Set(simNodes.map((n) => n.id));
      const simLinks: SimLink[] = links
        .filter((l) => ids.has(l.source) && ids.has(l.target))
        .map((l) => ({ source: l.source, target: l.target, value: l.value }));
      const degree = new Map<string, number>();
      for (const l of links) {
        degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
        degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
      }

      const maxSize = Math.max(0, ...nodes.map((n) => n.size ?? 0));
      const rScale = scaleSqrt().domain([0, maxSize || 1]).range([rMin, rMax]);
      const radius = (n: GraphNode) => (n.size != null && maxSize > 0 ? rScale(n.size) : nodeRadius);
      const maxValue = Math.max(1, ...links.map((l) => l.value ?? 1));

      const sim = forceSimulation<SimNode>(simNodes)
        .force('link', forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(linkDistance))
        .force('charge', forceManyBody().strength(chargeStrength))
        .force('center', forceCenter(width / 2, height / 2))
        // Gentle pull towards the middle keeps disconnected parts on a narrow screen.
        .force('x', forceX(width / 2).strength(0.06))
        .force('y', forceY(height / 2).strength(0.06))
        .force('collide', forceCollide<SimNode>((d) => radius(d) + 1.5));

      const root = ensureGroup(svg, 'd3c-root');
      const linkSel = ensureGroup(root, 'd3c-links')
        .selectAll<SVGLineElement, SimLink>('line.d3c-link')
        .data(simLinks)
        .join('line')
        .attr('class', 'd3c-link')
        .attr('stroke-width', (l) => 1 + ((l.value ?? 1) / maxValue) * 2);

      const nodeSel = ensureGroup(root, 'd3c-marks')
        .selectAll<SVGCircleElement, SimNode>('circle.d3c-node')
        .data(simNodes, (n) => n.id)
        .join((enter) => enter.append('circle').attr('class', 'd3c-node').attr('r', 0))
        .attr('r', radius)
        .attr('tabindex', 0)
        .attr('aria-label', (n) => n.label ?? n.id)
        .classed('d3c-clickable', !!onNodeClick)
        .style('fill', (n) => colorOf(groupKey(n)))
        .on('pointerenter pointermove', (event, n) => {
          const deg = degree.get(n.id) ?? 0;
          const rows = [{ label: 'Connections', value: defaultNumberFormat(deg), color: colorOf(groupKey(n)) }];
          if (n.group) rows.unshift({ label: 'Group', value: n.group, color: colorOf(groupKey(n)) });
          show(event, renderTooltip ? renderTooltip(n, deg) : <TooltipContent title={n.label ?? n.id} rows={rows} />);
        })
        .on('pointerleave', (event) => hide(event))
        .on('click', (_e, n) => onNodeClick?.(n));

      const labelSel = ensureGroup(root, 'd3c-node-labels')
        .selectAll<SVGTextElement, SimNode>('text.d3c-node-label')
        .data(showLabels ? simNodes : [], (n) => n.id)
        .join('text')
        .attr('class', 'd3c-node-label')
        .attr('dy', '0.35em')
        .text((n) => n.label ?? n.id);

      const clampX = (n: SimNode) => Math.max(radius(n), Math.min(width - radius(n), n.x ?? 0));
      const clampY = (n: SimNode) => Math.max(radius(n), Math.min(height - radius(n), n.y ?? 0));
      const render = () => {
        if (!zoomable) {
          for (const n of simNodes) {
            n.x = clampX(n);
            n.y = clampY(n);
          }
        }
        linkSel
          .attr('x1', (l) => (l.source as SimNode).x ?? 0)
          .attr('y1', (l) => (l.source as SimNode).y ?? 0)
          .attr('x2', (l) => (l.target as SimNode).x ?? 0)
          .attr('y2', (l) => (l.target as SimNode).y ?? 0);
        nodeSel.attr('cx', (n) => n.x ?? 0).attr('cy', (n) => n.y ?? 0);
        labelSel.attr('x', (n) => (n.x ?? 0) + radius(n) + 3).attr('y', (n) => n.y ?? 0);
        for (const n of simNodes) positions.current.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
      };

      const animated = isAnimated(anim);
      if (animated) {
        sim.on('tick', render);
      } else {
        sim.stop();
        sim.tick(Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())));
        render();
      }

      if (draggable) {
        nodeSel.call(
          drag<SVGCircleElement, SimNode>()
            .on('start', (event, n) => {
              if (!event.active) sim.alphaTarget(0.3).restart();
              n.fx = n.x;
              n.fy = n.y;
            })
            .on('drag', (event, n) => {
              n.fx = event.x;
              n.fy = event.y;
              if (!animated) {
                n.x = event.x;
                n.y = event.y;
                render();
              }
            })
            .on('end', (event, n) => {
              if (!event.active) sim.alphaTarget(0);
              n.fx = null;
              n.fy = null;
              if (!animated) sim.stop();
            }),
        );
        if (!animated) sim.on('tick', render);
      } else {
        nodeSel.on('.drag', null);
      }

      if (zoomable) {
        svg.call(
          zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 4])
            .on('zoom', (event) => root.attr('transform', event.transform.toString())),
        );
      } else {
        svg.on('.zoom', null);
        root.attr('transform', null);
      }

      return () => {
        sim.stop();
      };
    },
    [nodes, links, hidden, nodeRadius, rMin, rMax, linkDistance, chargeStrength, draggable, zoomable, showLabels, onNodeClick, renderTooltip, anim, colorOf, show, hide],
  );

  const legendItems = useMemo(() => keys.map((k) => ({ key: k, label: k, color: colorOf(k) })), [keys, colorOf]);

  return (
    <ChartContainer
      {...props}
      aspectRatio={props.aspectRatio ?? 1.2}
      chartType="force-graph"
      tooltipApi={tooltipApi}
      legendItems={legendItems}
      hidden={hidden}
      onToggle={toggle}
    >
      {(size) => <D3Svg size={size} draw={draw} label={typeof props.title === 'string' ? props.title : undefined} />}
    </ChartContainer>
  );
}
