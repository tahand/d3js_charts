import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GroupedBarChart, StackedBarChart } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const data = [
  { state: 'CA', young: 10, adult: 20, senior: 5 },
  { state: 'TX', young: 8, adult: 15, senior: 4 },
];

describe('GroupedBarChart', () => {
  it('infers series keys and draws a bar per key and category', () => {
    const { container } = render(<GroupedBarChart {...STATIC} data={data} categoryKey="state" />);
    expect(q(container, 'g.d3c-series').map((g) => g.getAttribute('data-key'))).toEqual(['young', 'adult', 'senior']);
    expect(q(container, 'path.d3c-bar')).toHaveLength(6);
  });

  it('renders a legend with display labels and toggles series', () => {
    const onLegendToggle = vi.fn();
    const { container } = render(
      <GroupedBarChart
        {...STATIC}
        data={data}
        categoryKey="state"
        seriesLabels={{ young: 'Under 18' }}
        onLegendToggle={onLegendToggle}
      />,
    );
    const button = screen.getByRole('button', { name: 'Under 18' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(onLegendToggle).toHaveBeenLastCalledWith(['young']);
    expect(q(container, 'path.d3c-bar')).toHaveLength(4);
    fireEvent.click(button);
    expect(q(container, 'path.d3c-bar')).toHaveLength(6);
  });

  it('never hides the last visible series', () => {
    const { container } = render(<GroupedBarChart {...STATIC} data={data} categoryKey="state" keys={['young', 'adult']} />);
    fireEvent.click(screen.getByRole('button', { name: 'young' }));
    fireEvent.click(screen.getByRole('button', { name: 'adult' }));
    expect(screen.getByRole('button', { name: 'adult' })).toHaveAttribute('aria-pressed', 'true');
    expect(q(container, 'path.d3c-bar')).toHaveLength(2);
  });

  it('keeps series colours stable when a series is hidden', () => {
    const { container } = render(
      <GroupedBarChart {...STATIC} data={data} categoryKey="state" colors={['red', 'green', 'blue']} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'young' }));
    const fills = q(container, 'g.d3c-series').map((g) => (g.querySelector('path') as SVGPathElement).style.fill);
    expect(fills).toEqual(['green', 'blue']);
  });

  it('tooltip lists every visible series for the category', () => {
    const { container } = render(<GroupedBarChart {...STATIC} data={data} categoryKey="state" />);
    hover(q(container, 'path.d3c-bar')[0]);
    const text = tooltipText(container)!;
    expect(text).toContain('CA');
    expect(text).toContain('young');
    expect(text).toContain('senior');
  });

  it('calls onBarClick with the row and key', () => {
    const onBarClick = vi.fn();
    const { container } = render(
      <GroupedBarChart {...STATIC} data={data} categoryKey="state" keys={['adult']} onBarClick={onBarClick} />,
    );
    fireEvent.click(q(container, 'path.d3c-bar')[1]);
    expect(onBarClick).toHaveBeenCalledWith(data[1], 'adult');
  });

  it('places the legend where asked', () => {
    const { container } = render(
      <GroupedBarChart {...STATIC} data={data} categoryKey="state" legend={{ position: 'top', title: 'Age' }} />,
    );
    const body = container.querySelector('.d3c-body')!;
    expect(body).toHaveClass('d3c-body--legend-top');
    expect(body.firstElementChild).toHaveClass('d3c-legend');
    expect(screen.getByText('Age')).toBeInTheDocument();
  });
});

describe('StackedBarChart', () => {
  it('stacks segments so each category is one column', () => {
    const { container } = render(<StackedBarChart {...STATIC} data={data} categoryKey="state" />);
    expect(container.querySelector('.d3c-stacked-bar-chart')).not.toBeNull();
    expect(q(container, 'path.d3c-bar')).toHaveLength(6);
    // The first (CA) segment of every series starts at the same x.
    const xs = q(container, 'g.d3c-series').map((g) => g.querySelector('path')!.getAttribute('d')!.match(/^M([\d.]+)/)![1]);
    expect(new Set(xs).size).toBe(1);
  });

  it('works horizontally', () => {
    const { container } = render(<StackedBarChart {...STATIC} data={data} categoryKey="state" orientation="horizontal" />);
    expect(q(container, 'path.d3c-bar')).toHaveLength(6);
    expect(q(container, '.d3c-axis--y .tick text').map((t) => t.textContent)).toEqual(['CA', 'TX']);
  });
});
