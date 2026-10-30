import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import type { TooltipApi } from '../hooks/useTooltip';
import type { BaseChartProps, ChartSize, ChartTheme, LegendItem, LegendOptions, LegendPosition } from '../types';
import { Legend } from './Legend';

/** Width assumed before the container has been measured (SSR, tests). */
export const FALLBACK_WIDTH = 600;
/** Below this root width, left/right legends move underneath the plot. */
export const NARROW_BREAKPOINT = 480;

const THEME_VARS: Record<keyof ChartTheme, string> = {
  fontFamily: '--d3c-font-family',
  fontSize: '--d3c-font-size',
  textColor: '--d3c-text',
  mutedTextColor: '--d3c-text-muted',
  axisColor: '--d3c-axis',
  gridColor: '--d3c-grid',
  background: '--d3c-background',
  tooltipBackground: '--d3c-tooltip-bg',
  tooltipColor: '--d3c-tooltip-text',
  markStroke: '--d3c-mark-stroke',
};

export function themeToStyle(theme: ChartTheme | undefined): CSSProperties {
  const style: Record<string, string> = {};
  if (!theme) return style;
  for (const [key, cssVar] of Object.entries(THEME_VARS)) {
    const value = theme[key as keyof ChartTheme];
    if (value != null) style[cssVar] = value;
  }
  return style as CSSProperties;
}

export function resolveLegend(legend: BaseChartProps['legend'], itemCount: number): Required<Pick<LegendOptions, 'show' | 'position' | 'interactive'>> & LegendOptions {
  const opts: LegendOptions = typeof legend === 'object' ? legend : {};
  const show = legend === false ? false : (opts.show ?? (legend === true || itemCount >= 2));
  return { ...opts, show, position: opts.position ?? 'bottom', interactive: opts.interactive ?? true };
}

export interface ChartContainerProps extends BaseChartProps {
  chartType: string;
  legendItems?: readonly LegendItem[];
  /** Replaces the item legend, e.g. a colour ramp. */
  legendNode?: ReactNode;
  hidden?: ReadonlySet<string>;
  onToggle?: (key: string) => void;
  tooltipApi: TooltipApi;
  children: (size: ChartSize) => ReactNode;
}

export function ChartContainer({
  chartType,
  width,
  height,
  aspectRatio = 1.6,
  minHeight = 220,
  theme,
  className,
  style,
  title,
  description,
  legend,
  legendItems = [],
  legendNode,
  hidden,
  onToggle,
  tooltipApi,
  children,
}: ChartContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rootSize = useElementSize(rootRef);
  const plotSize = useElementSize(tooltipApi.containerRef);

  const legendOpts = resolveLegend(legend, legendNode ? 2 : legendItems.length);
  const narrow = (rootSize?.width ?? width ?? FALLBACK_WIDTH) < NARROW_BREAKPOINT;
  let position: LegendPosition = legendOpts.position;
  if (narrow && (position === 'left' || position === 'right')) position = 'bottom';

  const plotWidth = width ?? plotSize?.width ?? FALLBACK_WIDTH;
  const plotHeight = height ?? Math.max(minHeight, Math.round(plotWidth / aspectRatio));

  const legendEl = legendOpts.show
    ? (legendNode ?? (
        <Legend
          items={legendItems}
          hidden={hidden}
          onToggle={onToggle}
          interactive={legendOpts.interactive}
          title={legendOpts.title}
          className={legendOpts.className}
          style={legendOpts.style}
          orientation={position === 'left' || position === 'right' ? 'vertical' : 'horizontal'}
        />
      ))
    : null;
  const legendFirst = position === 'top' || position === 'left';

  const tip = tooltipApi.tooltip;
  const tipStyle: CSSProperties | undefined = tip
    ? {
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.x > plotWidth / 2 ? 'calc(-100% - 12px)' : '12px'}, ${tip.y < 64 ? '12px' : 'calc(-100% - 12px)'})`,
      }
    : undefined;

  return (
    <div
      ref={rootRef}
      className={['d3c-chart', `d3c-${chartType}`, className].filter(Boolean).join(' ')}
      style={{ ...themeToStyle(theme), ...style }}
      role="figure"
      aria-label={typeof title === 'string' ? title : undefined}
      aria-description={description}
    >
      {title != null && <div className="d3c-title">{title}</div>}
      <div className={`d3c-body d3c-body--legend-${position}`}>
        {legendFirst && legendEl}
        <div
          ref={tooltipApi.containerRef}
          className="d3c-plot"
          style={width != null ? { width, flex: 'none' } : undefined}
        >
          {children({ width: plotWidth, height: plotHeight })}
          {tip && (
            <div className="d3c-tooltip" role="tooltip" style={tipStyle}>
              {tip.content}
            </div>
          )}
        </div>
        {!legendFirst && legendEl}
      </div>
    </div>
  );
}
