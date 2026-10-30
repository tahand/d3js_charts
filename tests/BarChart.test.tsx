import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BarChart } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const data = [
  { label: 'A', value: 30 },
  { label: 'B', value: 80 },
  { label: 'C', value: 45 },
];

/** Vertical extent of a bar path, from its V commands. */
function barHeight(el: Element) {
  const ys = (el.getAttribute('d') ?? '').match(/V[\d.]+/g)!.map((v) => Number(v.slice(1)));
  return Math.max(...ys) - Math.min(...ys);
}

describe('BarChart', () => {
  it('draws one bar per datum with accessible labels', () => {
    const { container } = render(<BarChart {...STATIC} data={data} />);
    const bars = q(container, 'path.d3c-bar');
    expect(bars).toHaveLength(3);
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual(['A: 30', 'B: 80', 'C: 45']);
    expect(bars.every((b) => b.getAttribute('d')?.startsWith('M'))).toBe(true);
  });

  it('makes taller bars for larger values', () => {
    const { container } = render(<BarChart {...STATIC} data={data} />);
    const [a, b, c] = q(container, 'path.d3c-bar').map(barHeight);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(a);
  });

  it('sorts bars', () => {
    const { container } = render(<BarChart {...STATIC} data={data} sort="descending" />);
    expect(q(container, 'path.d3c-bar').map((b) => b.getAttribute('aria-label'))).toEqual(['B: 80', 'C: 45', 'A: 30']);
  });

  it('supports horizontal orientation and value labels', () => {
    const { container } = render(
      <BarChart {...STATIC} data={data} orientation="horizontal" showValues valueFormat={(v) => `${v}%`} />,
    );
    expect(q(container, 'path.d3c-bar')).toHaveLength(3);
    expect(q(container, 'text.d3c-value-label').map((t) => t.textContent)).toEqual(['30%', '80%', '45%']);
    expect(q(container, '.d3c-axis--y .tick text').map((t) => t.textContent)).toEqual(['A', 'B', 'C']);
  });

  it('applies colours from props, per-bar overrides, theme, className and style', () => {
    const { container } = render(
      <BarChart
        {...STATIC}
        data={[...data.slice(0, 2), { label: 'C', value: 45, color: 'red' }]}
        colors={['#123456']}
        theme={{ textColor: 'rgb(1, 2, 3)' }}
        className="mine"
        style={{ border: '1px solid' }}
      />,
    );
    const bars = q<SVGPathElement>(container, 'path.d3c-bar');
    expect(bars[0].style.fill).toBe('rgb(18, 52, 86)');
    expect(bars[2].style.fill).toBe('red');
    const root = container.querySelector('.d3c-chart') as HTMLElement;
    expect(root).toHaveClass('mine', 'd3c-bar-chart');
    expect(root.style.getPropertyValue('--d3c-text')).toBe('rgb(1, 2, 3)');
    expect(root.style.border).toBe('1px solid');
  });

  it('shows a tooltip on hover and hides it on leave', () => {
    const { container } = render(<BarChart {...STATIC} data={data} />);
    const bar = q(container, 'path.d3c-bar')[1];
    hover(bar);
    expect(tooltipText(container)).toContain('B');
    expect(tooltipText(container)).toContain('80');
    fireEvent.pointerLeave(bar);
    expect(tooltipText(container)).toBeNull();
  });

  it('uses a custom tooltip renderer and can disable tooltips', () => {
    const { container, rerender } = render(
      <BarChart {...STATIC} data={data} renderTooltip={(d) => <b>custom {d.label}</b>} />,
    );
    hover(q(container, 'path.d3c-bar')[0]);
    expect(screen.getByText('custom A')).toBeInTheDocument();
    rerender(<BarChart {...STATIC} data={data} tooltip={false} />);
    hover(q(container, 'path.d3c-bar')[0]);
    expect(tooltipText(container)).toBeNull();
  });

  it('calls onBarClick', () => {
    const onBarClick = vi.fn();
    const { container } = render(<BarChart {...STATIC} data={data} onBarClick={onBarClick} />);
    fireEvent.click(q(container, 'path.d3c-bar')[2]);
    expect(onBarClick).toHaveBeenCalledWith(data[2], 2);
  });

  it('updates when data changes', () => {
    const { container, rerender } = render(<BarChart {...STATIC} data={data} />);
    rerender(<BarChart {...STATIC} data={[...data, { label: 'D', value: 10 }]} />);
    expect(q(container, 'path.d3c-bar')).toHaveLength(4);
    rerender(<BarChart {...STATIC} data={data.slice(0, 1)} />);
    expect(q(container, 'path.d3c-bar')).toHaveLength(1);
  });

  it('handles negative values', () => {
    const { container } = render(
      <BarChart {...STATIC} data={[{ label: 'up', value: 5 }, { label: 'down', value: -5 }]} />,
    );
    expect(q(container, 'path.d3c-bar')).toHaveLength(2);
    const ticks = q(container, '.d3c-axis--y .tick text').map((t) => t.textContent);
    expect(ticks).toContain('0');
    expect(ticks.some((t) => t?.startsWith('−') || t?.startsWith('-'))).toBe(true);
  });

  it('renders axis labels and a title', () => {
    render(<BarChart {...STATIC} data={data} title="Sales" valueAxis={{ label: 'Units' }} categoryAxis={{ label: 'Region' }} />);
    expect(screen.getByRole('figure', { name: 'Sales' })).toBeInTheDocument();
    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
  });

  it('has no legend for a single series', () => {
    const { container } = render(<BarChart {...STATIC} data={data} />);
    expect(container.querySelector('.d3c-legend')).toBeNull();
  });

  it('animates when animation is enabled', async () => {
    const { container } = render(<BarChart width={400} height={300} data={data} animation={{ enabled: true, duration: 20 }} />);
    const bar = q(container, 'path.d3c-bar')[1];
    const start = barHeight(bar);
    await new Promise((r) => setTimeout(r, 120));
    expect(barHeight(bar)).toBeGreaterThan(start);
  });
});
