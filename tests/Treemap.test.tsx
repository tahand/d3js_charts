import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Treemap } from '../src';
import type { HierarchyDatum } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const tree: HierarchyDatum = {
  name: 'root',
  children: [
    {
      name: 'Fruit',
      children: [
        { name: 'Apple', value: 40 },
        { name: 'Pear', value: 20 },
      ],
    },
    {
      name: 'Veg',
      children: [
        { name: 'Kale', value: 30 },
        { name: 'Leek', value: 10, children: [] },
      ],
    },
  ],
};

describe('Treemap', () => {
  it('draws a cell per leaf, sized by value', () => {
    const { container } = render(<Treemap {...STATIC} data={tree} />);
    const leaves = q(container, 'g.d3c-leaf');
    expect(leaves).toHaveLength(4);
    const area = (name: string) => {
      const g = leaves.find((l) => l.getAttribute('aria-label')!.includes(name))!;
      const r = g.querySelector('rect')!;
      return Number(r.getAttribute('width')) * Number(r.getAttribute('height'));
    };
    expect(area('Apple')).toBeGreaterThan(area('Kale'));
    expect(area('Kale')).toBeGreaterThan(area('Leek'));
  });

  it('colours leaves by their top-level group', () => {
    const { container } = render(<Treemap {...STATIC} data={tree} colors={['red', 'blue']} />);
    const fill = (name: string) =>
      (q(container, 'g.d3c-leaf').find((l) => l.getAttribute('aria-label')!.includes(name))!.querySelector('rect') as SVGRectElement).style.fill;
    expect(fill('Apple')).toBe('red');
    expect(fill('Pear')).toBe('red');
    expect(fill('Kale')).toBe('blue');
  });

  it('labels large leaves and shows the path in the tooltip', () => {
    const { container } = render(<Treemap {...STATIC} data={tree} />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    hover(q(container, 'g.d3c-leaf')[0]);
    expect(tooltipText(container)).toContain('Fruit / Apple');
  });

  it('toggles top-level groups from the legend', () => {
    const { container } = render(<Treemap {...STATIC} data={tree} />);
    fireEvent.click(screen.getByRole('button', { name: 'Veg' }));
    expect(q(container, 'g.d3c-leaf')).toHaveLength(2);
  });

  it('reports leaf clicks with their path', () => {
    const onLeafClick = vi.fn();
    const { container } = render(<Treemap {...STATIC} data={tree} onLeafClick={onLeafClick} />);
    const pear = q(container, 'g.d3c-leaf').find((l) => l.getAttribute('aria-label')!.includes('Pear'))!;
    fireEvent.click(pear);
    expect(onLeafClick).toHaveBeenCalledWith({ name: 'Pear', value: 20 }, ['Fruit', 'Pear']);
  });

  it('supports other tiling methods', () => {
    const { container } = render(<Treemap {...STATIC} data={tree} tile="slice" />);
    // Slice lays the top-level groups out as horizontal bands spanning the full width.
    const widths = q(container, 'g.d3c-leaf rect').map((r) => Number(r.getAttribute('width')));
    expect(new Set(widths).size).toBe(1);
  });
});
