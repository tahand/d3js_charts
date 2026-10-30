import { useLayoutEffect, useState, type RefObject } from 'react';
import type { ChartSize } from '../types';

/**
 * Tracks an element's content box with a ResizeObserver. Returns `null` until
 * the first measurement, or when the element has no layout (e.g. in jsdom).
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ChartSize | null {
  const [size, setSize] = useState<ChartSize | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (width: number, height: number) => {
      const w = Math.round(width);
      const h = Math.round(height);
      if (w <= 0) return;
      setSize((prev) => (prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    update(el.clientWidth, el.clientHeight);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) update(rect.width, rect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
