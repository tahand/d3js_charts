import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sunburst } from '../src';
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

describe('Sunburst', () => {
  it('draws an arc for every node below the root', () => {
    const { container } = render(<Sunburst {...STATIC} data={tree} />);
    // 2 groups + 4 leaves (the empty-children Leek counts as a leaf).
    expect(q(container, 'path.d3c-arc')).toHaveLength(6);
  });

  it('limits rings with maxDepth', () => {
    const { container } = render(<Sunburst {...STATIC} data={tree} maxDepth={1} />);
    expect(q(container, 'path.d3c-arc')).toHaveLength(2);
  });

  it('shows the share of the whole in the tooltip', () => {
    const { container } = render(<Sunburst {...STATIC} data={tree} />);
    const fruit = q(container, 'path.d3c-arc').find((a) => a.getAttribute('aria-label')!.startsWith('Fruit:'))!;
    hover(fruit);
    expect(tooltipText(container)).toContain('60');
    expect(tooltipText(container)).toContain('60.0%');
  });

  it('toggles groups and reports clicks', () => {
    const onArcClick = vi.fn();
    const { container } = render(<Sunburst {...STATIC} data={tree} onArcClick={onArcClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }));
    expect(q(container, 'path.d3c-arc')).toHaveLength(3);
    fireEvent.click(q(container, 'path.d3c-arc')[0]);
    expect(onArcClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Veg' }), ['Veg']);
  });
});
