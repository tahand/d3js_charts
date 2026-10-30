import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForceGraph } from '../src';
import { hover, q, STATIC, tooltipText } from './helpers';

const nodes = [
  { id: 'a', group: 'x' },
  { id: 'b', group: 'x' },
  { id: 'c', group: 'y', label: 'Charlie' },
  { id: 'd', group: 'y', size: 10 },
];
const links = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c', value: 3 },
  { source: 'c', target: 'd' },
];

describe('ForceGraph', () => {
  it('draws nodes and links and settles the layout synchronously when not animated', () => {
    const { container } = render(<ForceGraph {...STATIC} nodes={nodes} links={links} />);
    expect(q(container, 'circle.d3c-node')).toHaveLength(4);
    expect(q(container, 'line.d3c-link')).toHaveLength(3);
    for (const c of q(container, 'circle.d3c-node')) {
      const cx = Number(c.getAttribute('cx'));
      const cy = Number(c.getAttribute('cy'));
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cx).toBeLessThanOrEqual(400);
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(300);
    }
  });

  it('keeps linked nodes closer than the canvas size', () => {
    const { container } = render(<ForceGraph {...STATIC} nodes={nodes} links={links} linkDistance={30} />);
    const line = q(container, 'line.d3c-link')[0];
    const dx = Number(line.getAttribute('x2')) - Number(line.getAttribute('x1'));
    const dy = Number(line.getAttribute('y2')) - Number(line.getAttribute('y1'));
    expect(Math.hypot(dx, dy)).toBeLessThan(150);
  });

  it('hides a group and its links from the legend', () => {
    const { container } = render(<ForceGraph {...STATIC} nodes={nodes} links={links} />);
    fireEvent.click(screen.getByRole('button', { name: 'y' }));
    expect(q(container, 'circle.d3c-node')).toHaveLength(2);
    expect(q(container, 'line.d3c-link')).toHaveLength(1);
  });

  it('sizes nodes by `size` and shows labels', () => {
    const { container } = render(<ForceGraph {...STATIC} nodes={nodes} links={links} showLabels sizeRange={[3, 15]} />);
    const d = q(container, 'circle.d3c-node').find((c) => c.getAttribute('aria-label') === 'd')!;
    expect(Number(d.getAttribute('r'))).toBeCloseTo(15);
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows connections in the tooltip and reports clicks', () => {
    const onNodeClick = vi.fn();
    const { container } = render(<ForceGraph {...STATIC} nodes={nodes} links={links} onNodeClick={onNodeClick} />);
    const b = q(container, 'circle.d3c-node')[1];
    hover(b);
    expect(tooltipText(container)).toContain('Connections2');
    fireEvent.click(b);
    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('stops the simulation on unmount', () => {
    const { unmount } = render(<ForceGraph width={400} height={300} nodes={nodes} links={links} animation={{ enabled: true }} />);
    expect(() => unmount()).not.toThrow();
  });
});
