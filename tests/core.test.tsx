import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorRampLegend, createColorScale, DEFAULT_COLORS, defaultNumberFormat, defaultTickFormat, Legend, resolveAnimation } from '../src';
import { ChartContainer, resolveLegend, themeToStyle } from '../src/core/ChartContainer';
import { estimateTextWidth, resolveMargin } from '../src/core/axes';
import { truncateLabel } from '../src/core/format';
import { roundedBarPath } from '../src/core/shapes';
import { useSeriesVisibility } from '../src/hooks/useSeriesVisibility';
import { TOUCH_TOOLTIP_MS, useTooltip } from '../src/hooks/useTooltip';

describe('createColorScale', () => {
  it('assigns palette colours in key order and wraps', () => {
    const color = createColorScale(['a', 'b'], ['red', 'blue']);
    expect(color('a')).toBe('red');
    expect(color('b')).toBe('blue');
    expect(color('c')).toBe('red');
  });

  it('uses the default palette and accepts a function', () => {
    expect(createColorScale(['a'])('a')).toBe(DEFAULT_COLORS[0]);
    const fn = createColorScale(['a', 'b'], (key, i) => `${key}-${i}`);
    expect(fn('b')).toBe('b-1');
  });
});

describe('resolveAnimation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to on, 600ms', () => {
    expect(resolveAnimation(undefined)).toMatchObject({ enabled: true, duration: 600, delay: 0 });
  });

  it('can be turned off or configured', () => {
    expect(resolveAnimation(false)).toMatchObject({ enabled: false, duration: 0 });
    expect(resolveAnimation({ duration: 100, stagger: 10 })).toMatchObject({ enabled: true, duration: 100, stagger: 10 });
  });

  it('honours prefers-reduced-motion unless explicitly enabled', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(resolveAnimation(undefined).enabled).toBe(false);
    expect(resolveAnimation({ enabled: true }).enabled).toBe(true);
  });
});

describe('formatting helpers', () => {
  it('formats numbers', () => {
    expect(defaultNumberFormat(1234567)).toBe('1,234,567');
    expect(defaultNumberFormat(3.14159)).toBe('3.14');
    expect(defaultTickFormat(25000)).toBe('25k');
    expect(defaultTickFormat(2_000_000_000)).toBe('2B');
  });

  it('truncates long labels', () => {
    expect(truncateLabel('short', 200)).toBe('short');
    expect(truncateLabel('a very long category name', 60)).toMatch(/…$/);
    expect(estimateTextWidth('abcd', 10)).toBe(24);
  });

  it('merges margins: defaults < automatic < user', () => {
    expect(resolveMargin({ top: 1 }, { left: 50, top: 9 })).toEqual({ top: 1, right: 16, bottom: 32, left: 50 });
  });
});

describe('roundedBarPath', () => {
  it('produces the same command structure for every radius', () => {
    const shape = (d: string) => d.replace(/[-\d.]+/g, '#');
    expect(shape(roundedBarPath(0, 0, 10, 50, 4, 'top'))).toBe(shape(roundedBarPath(0, 0, 10, 0, 4, 'top')));
    expect(roundedBarPath(0, 0, 10, 50, 0, 'right')).toContain('H10');
  });

  it('clamps the radius to the bar size', () => {
    expect(roundedBarPath(0, 0, 4, 50, 10, 'top')).toContain('Q0,0 2,0');
  });
});

describe('Legend', () => {
  const items = [
    { key: 'a', label: 'Alpha', color: 'red' },
    { key: 'b', label: 'Beta', color: 'blue' },
  ];

  it('renders toggle buttons that report their state', () => {
    const onToggle = vi.fn();
    render(<Legend items={items} hidden={new Set(['b'])} onToggle={onToggle} title="Series" />);
    expect(screen.getByText('Series')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('renders static items when not interactive', () => {
    render(<Legend items={items} onToggle={() => {}} interactive={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('renders a colour ramp', () => {
    const { container } = render(<ColorRampLegend interpolator={() => 'red'} min={0} max={10} format={(v) => `${v}°`} />);
    expect(container.textContent).toContain('0°');
    expect(container.textContent).toContain('10°');
  });
});

describe('resolveLegend / themeToStyle', () => {
  it('shows the legend for two or more items by default', () => {
    expect(resolveLegend(undefined, 1).show).toBe(false);
    expect(resolveLegend(undefined, 2).show).toBe(true);
    expect(resolveLegend(false, 5).show).toBe(false);
    expect(resolveLegend(true, 1).show).toBe(true);
    expect(resolveLegend({ position: 'right' }, 3)).toMatchObject({ show: true, position: 'right', interactive: true });
  });

  it('maps theme keys to CSS variables', () => {
    expect(themeToStyle({ gridColor: '#eee', fontSize: '14px' })).toEqual({ '--d3c-grid': '#eee', '--d3c-font-size': '14px' });
    expect(themeToStyle(undefined)).toEqual({});
  });
});

describe('useSeriesVisibility', () => {
  it('toggles keys and reports changes', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSeriesVisibility(['a', 'b'], onChange));
    act(() => result.current.toggle('a'));
    expect(result.current.isVisible('a')).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(['a']);
    act(() => result.current.toggle('b'));
    expect(result.current.isVisible('b')).toBe(true);
    act(() => result.current.toggle('a'));
    expect(result.current.hidden.size).toBe(0);
  });
});

describe('useTooltip', () => {
  it('keeps a touch tooltip up briefly after the finger lifts', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTooltip());
    act(() => result.current.show(new MouseEvent('pointerenter'), 'hi'));
    expect(result.current.tooltip?.content).toBe('hi');
    const touchLeave = Object.assign(new Event('pointerleave'), { pointerType: 'touch' });
    act(() => result.current.hide(touchLeave));
    expect(result.current.tooltip).not.toBeNull();
    act(() => vi.advanceTimersByTime(TOUCH_TOOLTIP_MS + 1));
    expect(result.current.tooltip).toBeNull();
    vi.useRealTimers();
  });

  it('ignores show() when disabled', () => {
    const { result } = renderHook(() => useTooltip(false));
    act(() => result.current.show(new MouseEvent('pointerenter'), 'hi'));
    expect(result.current.tooltip).toBeNull();
  });
});

describe('ChartContainer', () => {
  function Harness(props: { width?: number; height?: number; aspectRatio?: number; position?: 'left' | 'right' | 'bottom' }) {
    const tooltipApi = useTooltip();
    return (
      <ChartContainer
        chartType="test"
        width={props.width}
        height={props.height}
        aspectRatio={props.aspectRatio}
        legend={{ position: props.position }}
        legendItems={[
          { key: 'a', label: 'A', color: 'red' },
          { key: 'b', label: 'B', color: 'blue' },
        ]}
        tooltipApi={tooltipApi}
      >
        {(size) => <span data-testid="size">{`${size.width}x${size.height}`}</span>}
      </ChartContainer>
    );
  }

  it('derives height from width and aspect ratio, with a minimum', () => {
    render(<Harness width={800} aspectRatio={2} />);
    expect(screen.getByTestId('size').textContent).toBe('800x400');
  });

  it('enforces the minimum height on small widths', () => {
    render(<Harness width={300} />);
    expect(screen.getByTestId('size').textContent).toBe('300x220');
  });

  it('moves a side legend underneath on narrow screens', () => {
    const { container, rerender } = render(<Harness width={800} position="right" />);
    expect(container.querySelector('.d3c-body')).toHaveClass('d3c-body--legend-right');
    rerender(<Harness width={320} position="right" />);
    expect(container.querySelector('.d3c-body')).toHaveClass('d3c-body--legend-bottom');
  });

  it('sizes to its container when measured', () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 360 });
    try {
      render(<Harness height={200} />);
      expect(screen.getByTestId('size').textContent).toBe('360x200');
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original);
    }
  });
});
