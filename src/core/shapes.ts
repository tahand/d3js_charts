export type BarEnd = 'top' | 'bottom' | 'left' | 'right';

/**
 * A rectangle path with only its data end rounded. The command structure is
 * identical for every radius (including 0), so d3 can tween between bars.
 */
export function roundedBarPath(x: number, y: number, w: number, h: number, radius: number, end: BarEnd): string {
  w = Math.max(0, w);
  h = Math.max(0, h);
  const along = end === 'top' || end === 'bottom' ? h : w;
  const across = end === 'top' || end === 'bottom' ? w : h;
  const r = Math.max(0, Math.min(radius, across / 2, along));
  switch (end) {
    case 'top':
      return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
    case 'bottom':
      return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
    case 'right':
      return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
    case 'left':
      return `M${x + w},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w}Z`;
  }
}
