import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AreaChart, LineChart } from '../src';
import { q, STATIC, tooltipText } from './helpers';

const series = [
  { key: 'a', label: 'Apples', data: [{ x: 1, y: 10 }, { x: 2, y: 30 }, { x: 3, y: 20 }] },
  { key: 'b', label: 'Bananas', data: [{ x: 1, y: 5 }, { x: 2, y: 8 }, { x: 3, y: 12 }] },
];

describe('LineChart', () => {
  it('draws one line per series', () => {
    const { container } = render(<LineChart {...STATIC} series={series} />);
    expect(q(container, 'path.d3c-line')).toHaveLength(2);
    expect(q(container, 'path.d3c-area')).toHaveLength(0);
    expect(container.querySelector('.d3c-line-chart')).not.toBeNull();
  });

  it('shows points when asked', () => {
    const { container } = render(<LineChart {...STATIC} series={series} showPoints />);
    expect(q(container, 'circle.d3c-point')).toHaveLength(6);
  });

  it('accepts Date x values and uses a time axis', () => {
    const dated = [{ key: 't', data: [0, 1, 2].map((i) => ({ x: new Date(2024, i, 1), y: i })) }];
    const { container } = render(<LineChart {...STATIC} series={dated} />);
    expect(q(container, 'path.d3c-line')).toHaveLength(1);
    expect(q(container, '.d3c-axis--x .tick').length).toBeGreaterThan(1);
  });

  it('toggles series from the legend', () => {
    const { container } = render(<LineChart {...STATIC} series={series} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bananas' }));
    expect(q(container, 'g.d3c-series').map((g) => g.getAttribute('data-key'))).toEqual(['a']);
  });

  it('shows a crosshair tooltip with every series value', () => {
    const { container } = render(<LineChart {...STATIC} series={series} valueFormat={(v) => `$${v}`} />);
    const overlay = container.querySelector('rect.d3c-overlay')!;
    fireEvent.pointerMove(overlay, { clientX: 0, clientY: 0 });
    const text = tooltipText(container)!;
    expect(text).toContain('Apples');
    expect(text).toContain('$10');
    expect(text).toContain('$5');
    expect(q(container, 'circle.d3c-hover-dot')).toHaveLength(2);
    fireEvent.pointerLeave(overlay);
    expect(tooltipText(container)).toBeNull();
  });

  it('uses per-series colours', () => {
    const { container } = render(<LineChart {...STATIC} series={[{ ...series[0], color: 'purple' }]} />);
    expect((container.querySelector('path.d3c-line') as SVGPathElement).style.stroke).toBe('purple');
  });

  it('fits the y axis to the data instead of forcing zero', () => {
    const high = [{ key: 'h', data: [{ x: 1, y: 60 }, { x: 2, y: 120 }] }];
    const { container } = render(<LineChart {...STATIC} series={high} />);
    const ticks = q(container, '.d3c-axis--y .tick text').map((t) => Number(t.textContent));
    expect(ticks[0]).toBeGreaterThanOrEqual(60);
  });

  it('respects a fixed y domain', () => {
    const { container } = render(<LineChart {...STATIC} series={series} yAxis={{ min: 0, max: 100, ticks: 2 }} />);
    const ticks = q(container, '.d3c-axis--y .tick text').map((t) => t.textContent);
    expect(ticks[0]).toBe('0');
    expect(ticks[ticks.length - 1]).toBe('100');
  });
});

describe('AreaChart', () => {
  it('draws an area and an outline per series', () => {
    const { container } = render(<AreaChart {...STATIC} series={series} />);
    expect(q(container, 'path.d3c-area')).toHaveLength(2);
    expect(q(container, 'path.d3c-line')).toHaveLength(2);
  });

  it('stacks series so the top of the stack is the total', () => {
    const { container } = render(<AreaChart {...STATIC} series={series} stacked showPoints />);
    const topSeries = q(container, 'g.d3c-series')[1];
    const cys = q(topSeries, 'circle.d3c-point').map((c) => Number(c.getAttribute('cy')));
    const bottomCys = q(q(container, 'g.d3c-series')[0], 'circle.d3c-point').map((c) => Number(c.getAttribute('cy')));
    // Stacked points sit above (smaller y) the series beneath them.
    cys.forEach((cy, i) => expect(cy).toBeLessThan(bottomCys[i]));
    // Tooltip reports each series' own value, not the stacked total.
    fireEvent.pointerMove(container.querySelector('rect.d3c-overlay')!, { clientX: 0 });
    expect(tooltipText(container)).toContain('5');
  });

  it('stacks series whose x values differ', () => {
    const ragged = [
      { key: 'a', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
      { key: 'b', data: [{ x: 2, y: 3 }, { x: 3, y: 4 }] },
    ];
    const { container } = render(<AreaChart {...STATIC} series={ragged} stacked />);
    expect(q(container, 'path.d3c-area').every((p) => !p.getAttribute('d')!.includes('NaN'))).toBe(true);
  });
});
