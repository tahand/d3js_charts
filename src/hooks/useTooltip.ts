import { pointer } from 'd3';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** How long a tooltip opened by a tap stays visible on touch screens. */
export const TOUCH_TOOLTIP_MS = 2500;

/**
 * Tooltip state positioned relative to `containerRef`. `show` and `hide` are
 * stable, so they can be bound inside d3 event handlers.
 *
 * On touch, a tap shows the tooltip and it stays until the next tap or a short
 * timeout, since touch pointers "leave" as soon as the finger lifts.
 */
export function useTooltip(enabled = true) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clearTimer = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };

  const show = useCallback((event: Event, content: ReactNode) => {
    if (!enabledRef.current) return;
    clearTimer();
    const [x, y] = containerRef.current ? pointer(event, containerRef.current) : [0, 0];
    setTooltip({ x, y, content });
  }, []);

  const hide = useCallback((event?: Event) => {
    clearTimer();
    if (event && (event as PointerEvent).pointerType === 'touch') {
      timer.current = setTimeout(() => setTooltip(null), TOUCH_TOOLTIP_MS);
      return;
    }
    setTooltip(null);
  }, []);

  useEffect(() => {
    if (!enabled) setTooltip(null);
  }, [enabled]);

  useEffect(() => clearTimer, []);

  return { containerRef, tooltip, show, hide };
}

export type TooltipApi = ReturnType<typeof useTooltip>;
