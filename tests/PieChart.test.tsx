import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DonutChart, PieChart } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const data = [
  { label: 'Red', value: 50 },
  { label: 'Blue', value: 30 },
  { label: 'Green', value: 20 },
];

describe('PieChart', () => {
  it('draws a slice per positive value and skips zeros', () => {
    const { container } = render(<PieChart {...STATIC} data={[...data, { label: 'Zero', value: 0 }]} />);
    expect(q(container, 'path.d3c-slice')).toHaveLength(3);
    expect(container.querySelector('.d3c-pie-chart')).not.toBeNull();
  });

  it('labels slices with percentages by default', () => {
    const { container } = render(<PieChart {...STATIC} data={data} />);
    expect(q(container, 'text.d3c-slice-label').map((t) => t.textContent)).toEqual(['50%', '30%', '20%']);
  });

  it('supports value and name labels, or none', () => {
    const { container, rerender } = render(<PieChart {...STATIC} data={data} labels="label" />);
    expect(q(container, 'text.d3c-slice-label').map((t) => t.textContent)).toEqual(['Red', 'Blue', 'Green']);
    rerender(<PieChart {...STATIC} data={data} labels="none" />);
    expect(q(container, 'text.d3c-slice-label')).toHaveLength(0);
  });

  it('shows value and share in the tooltip', () => {
    const { container } = render(<PieChart {...STATIC} data={data} />);
    hover(q(container, 'path.d3c-slice')[1]);
    expect(tooltipText(container)).toContain('Blue');
    expect(tooltipText(container)).toContain('30.0%');
  });

  it('hides slices from the legend and re-normalises shares', () => {
    const { container } = render(<PieChart {...STATIC} data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(q(container, 'path.d3c-slice')).toHaveLength(2);
    expect(q(container, 'text.d3c-slice-label').map((t) => t.textContent)).toEqual(['60%', '40%']);
  });

  it('calls onSliceClick', () => {
    const onSliceClick = vi.fn();
    const { container } = render(<PieChart {...STATIC} data={data} onSliceClick={onSliceClick} />);
    fireEvent.click(q(container, 'path.d3c-slice')[2]);
    expect(onSliceClick).toHaveBeenCalledWith(data[2], 2);
  });

  it('sorts by value when asked', () => {
    const { container } = render(<PieChart {...STATIC} data={[...data].reverse()} sortByValue />);
    // Slices stay in data order in the DOM; the largest (Red) now starts at 12 o'clock.
    const startX = (el: Element) => Math.abs(Number(el.getAttribute('d')!.match(/^M(-?[\d.e-]+)/)![1]));
    const [green, , red] = q(container, 'path.d3c-slice');
    expect(startX(red)).toBeLessThan(startX(green));
  });
});

describe('DonutChart', () => {
  it('has a hole and shows the total in the centre', () => {
    const { container } = render(<DonutChart {...STATIC} data={data} />);
    expect(container.querySelector('.d3c-donut-chart')).not.toBeNull();
    expect(container.querySelector('text.d3c-center-label')?.textContent).toBe('100');
  });

  it('accepts a custom centre label or none', () => {
    const { container, rerender } = render(<DonutChart {...STATIC} data={data} centerLabel="Votes" />);
    expect(container.querySelector('text.d3c-center-label')?.textContent).toBe('Votes');
    rerender(<DonutChart {...STATIC} data={data} centerLabel={false} />);
    expect(container.querySelector('text.d3c-center-label')).toBeNull();
  });
});
