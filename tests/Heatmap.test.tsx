import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Heatmap } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const data = ['Mon', 'Tue'].flatMap((y, yi) => ['9am', '10am', '11am'].map((x, xi) => ({ x, y, value: yi * 3 + xi })));

describe('Heatmap', () => {
  it('draws one cell per datum', () => {
    const { container } = render(<Heatmap {...STATIC} data={data} />);
    expect(q(container, 'rect.d3c-cell')).toHaveLength(6);
    expect(q(container, '.d3c-axis--x .tick text').map((t) => t.textContent)).toEqual(['9am', '10am', '11am']);
  });

  it('respects explicit row and column order', () => {
    const { container } = render(<Heatmap {...STATIC} data={data} yKeys={['Tue', 'Mon']} xKeys={['11am', '10am', '9am']} />);
    expect(q(container, '.d3c-axis--y .tick text').map((t) => t.textContent)).toEqual(['Tue', 'Mon']);
    expect(q(container, '.d3c-axis--x .tick text').map((t) => t.textContent)).toEqual(['11am', '10am', '9am']);
  });

  it('colours cells along the ramp', () => {
    const { container } = render(<Heatmap {...STATIC} data={data} colorInterpolator={(t) => (t < 0.5 ? 'white' : 'black')} />);
    const fills = q<SVGRectElement>(container, 'rect.d3c-cell').map((c) => c.style.fill);
    expect(fills[0]).toBe('white');
    expect(fills[5]).toBe('black');
  });

  it('shows a colour-ramp legend with the domain', () => {
    const { container } = render(<Heatmap {...STATIC} data={data} valueLabel="Visits" />);
    expect(container.querySelector('.d3c-legend__ramp')).not.toBeNull();
    expect(container.querySelector('.d3c-legend__title')?.textContent).toBe('Visits');
    expect(q(container, '.d3c-legend__ramp-labels span').map((s) => s.textContent)).toEqual(['0', '5']);
  });

  it('prints values and handles hover and click', () => {
    const onCellClick = vi.fn();
    const { container } = render(<Heatmap {...STATIC} data={data} showValues onCellClick={onCellClick} />);
    expect(q(container, 'text.d3c-cell-label')).toHaveLength(6);
    const cell = q(container, 'rect.d3c-cell')[4];
    hover(cell);
    expect(tooltipText(container)).toContain('10am · Tue');
    fireEvent.click(cell);
    expect(onCellClick).toHaveBeenCalledWith(data[4]);
  });

  it('can hide the legend', () => {
    const { container } = render(<Heatmap {...STATIC} data={data} legend={false} />);
    expect(container.querySelector('.d3c-legend')).toBeNull();
  });
});
