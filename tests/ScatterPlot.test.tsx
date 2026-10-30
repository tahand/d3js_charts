import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScatterPlot } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const series = [
  { key: 'm', label: 'Male', data: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
  { key: 'f', label: 'Female', data: [{ x: 2, y: 3, label: 'Ann' }] },
];

describe('ScatterPlot', () => {
  it('draws a dot per point', () => {
    const { container } = render(<ScatterPlot {...STATIC} series={series} />);
    expect(q(container, 'circle.d3c-dot')).toHaveLength(3);
    expect(q(container, 'circle.d3c-dot').every((c) => c.getAttribute('r') === '5')).toBe(true);
  });

  it('becomes a bubble chart when points carry size', () => {
    const bubbles = [{ key: 'b', data: [{ x: 1, y: 1, size: 1 }, { x: 2, y: 2, size: 100 }] }];
    const { container } = render(<ScatterPlot {...STATIC} series={bubbles} sizeRange={[2, 20]} />);
    const radii = q(container, 'circle.d3c-dot').map((c) => Number(c.getAttribute('r'))).sort((a, b) => a - b);
    expect(radii[1]).toBeCloseTo(20);
    expect(radii[0]).toBeLessThan(radii[1]);
  });

  it('shows the point in a tooltip using axis labels', () => {
    const { container } = render(<ScatterPlot {...STATIC} series={series} xAxis={{ label: 'Height' }} />);
    const ann = q(container, 'circle.d3c-dot').find((c) => c.getAttribute('aria-label')?.startsWith('Ann'))!;
    hover(ann);
    expect(tooltipText(container)).toContain('Ann');
    expect(tooltipText(container)).toContain('Height');
  });

  it('toggles series without rescaling the axes', () => {
    const { container } = render(<ScatterPlot {...STATIC} series={series} />);
    const ticksBefore = q(container, '.d3c-axis--x .tick text').map((t) => t.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    expect(q(container, 'circle.d3c-dot')).toHaveLength(1);
    expect(q(container, '.d3c-axis--x .tick text').map((t) => t.textContent)).toEqual(ticksBefore);
  });

  it('writes point labels and handles clicks', () => {
    const onPointClick = vi.fn();
    const { container } = render(<ScatterPlot {...STATIC} series={series} showLabels onPointClick={onPointClick} />);
    expect(q(container, 'text.d3c-point-label').map((t) => t.textContent)).toEqual(['Ann']);
    fireEvent.click(q(container, 'circle.d3c-dot')[0]);
    expect(onPointClick).toHaveBeenCalledTimes(1);
  });
});
