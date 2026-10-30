import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Histogram } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const values = [1, 2, 2, 3, 3, 3, 4, 4, 5, 9];

const count = (el: Element) => Number(el.getAttribute('aria-label')!.split(': ')[1]);

describe('Histogram', () => {
  it('bins the raw values and keeps every observation', () => {
    const { container } = render(<Histogram {...STATIC} data={values} />);
    const bars = q(container, 'path.d3c-bar');
    expect(bars.length).toBeGreaterThan(1);
    expect(bars.map(count).reduce((a, b) => a + b, 0)).toBe(values.length);
  });

  it('honours explicit thresholds', () => {
    const { container } = render(<Histogram {...STATIC} data={values} thresholds={[0, 5, 10]} />);
    expect(q(container, 'path.d3c-bar').map(count)).toEqual([8, 2]);
  });

  it('describes the bin range in the tooltip', () => {
    const { container } = render(<Histogram {...STATIC} data={values} thresholds={[0, 5, 10]} seriesLabel="People" />);
    hover(q(container, 'path.d3c-bar')[0]);
    expect(tooltipText(container)).toContain('0 – 5');
    expect(tooltipText(container)).toContain('People');
  });

  it('reports the bin on click', () => {
    const onBinClick = vi.fn();
    const { container } = render(<Histogram {...STATIC} data={values} thresholds={[0, 5, 10]} onBinClick={onBinClick} />);
    fireEvent.click(q(container, 'path.d3c-bar')[1]);
    expect(onBinClick).toHaveBeenCalledWith(expect.objectContaining({ x0: 5, x1: 10, count: 2, values: [5, 9] }));
  });

  it('renders an empty dataset without crashing', () => {
    const { container } = render(<Histogram {...STATIC} data={[]} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
