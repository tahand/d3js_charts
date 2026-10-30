import type { CSSProperties } from 'react';
import type { LegendItem } from '../types';

export interface LegendProps {
  items: readonly LegendItem[];
  hidden?: ReadonlySet<string>;
  onToggle?: (key: string) => void;
  interactive?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  orientation?: 'horizontal' | 'vertical';
}

export function Legend({
  items,
  hidden,
  onToggle,
  interactive = true,
  title,
  className,
  style,
  orientation = 'horizontal',
}: LegendProps) {
  const clickable = interactive && !!onToggle;
  return (
    <div
      className={['d3c-legend', `d3c-legend--${orientation}`, className].filter(Boolean).join(' ')}
      style={style}
    >
      {title && <div className="d3c-legend__title">{title}</div>}
      <ul className="d3c-legend__items">
        {items.map((item) => {
          const off = hidden?.has(item.key) ?? false;
          const content = (
            <>
              <span className="d3c-legend__swatch" style={{ background: item.color }} aria-hidden="true" />
              <span className="d3c-legend__label">{item.label}</span>
            </>
          );
          return (
            <li key={item.key} className={`d3c-legend__item${off ? ' d3c-legend__item--off' : ''}`}>
              {clickable ? (
                <button
                  type="button"
                  className="d3c-legend__button"
                  aria-pressed={!off}
                  onClick={() => onToggle!(item.key)}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface ColorRampLegendProps {
  /** Colour interpolator over [0, 1]. */
  interpolator: (t: number) => string;
  min: number;
  max: number;
  format?: (v: number) => string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/** A continuous gradient legend for sequential encodings such as heatmaps. */
export function ColorRampLegend({
  interpolator,
  min,
  max,
  format = String,
  title,
  className,
  style,
}: ColorRampLegendProps) {
  const stops = Array.from({ length: 11 }, (_, i) => `${interpolator(i / 10)} ${i * 10}%`).join(', ');
  return (
    <div className={['d3c-legend', 'd3c-legend--ramp', className].filter(Boolean).join(' ')} style={style}>
      {title && <div className="d3c-legend__title">{title}</div>}
      <div className="d3c-legend__ramp" style={{ background: `linear-gradient(to right, ${stops})` }} />
      <div className="d3c-legend__ramp-labels">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
