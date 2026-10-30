import { useEffect, useRef } from 'react';
import type { ChartSize } from '../types';

export type DrawFn = (svg: SVGSVGElement, size: ChartSize) => void | (() => void);

/**
 * An `<svg>` that React sizes and d3 draws into. `draw` re-runs whenever it
 * changes identity or the size changes; it may return a cleanup function.
 */
export function D3Svg({ size, draw, label }: { size: ChartSize; draw: DrawFn; label?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const { width, height } = size;

  useEffect(() => {
    if (!ref.current) return;
    return draw(ref.current, { width, height }) ?? undefined;
  }, [draw, width, height]);

  return (
    <svg
      ref={ref}
      className="d3c-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    />
  );
}
