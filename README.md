# d3js_charts

Mobile-friendly, animated D3.js chart components for React, written in TypeScript.

- **12 charts** from the [D3 gallery](https://observablehq.com/@d3/gallery): bar, grouped bar, stacked bar, line, area / stacked area, pie, donut, scatterplot / bubble, histogram, heatmap, treemap, sunburst, force-directed graph
- **Responsive.** Charts fill their parent and redraw on resize. On narrow screens they show fewer ticks, rotate long labels, and move side legends underneath.
- **Touch-friendly.** Tap a mark to see its tooltip. Legend buttons are at least 32px tall, and force-graph nodes can be dragged with a finger.
- **Animated.** Charts animate when they first draw and when data changes, using d3 transitions. Animation respects `prefers-reduced-motion`.
- **Interactive legends.** Click a legend item to hide or show its series. Each series keeps its colour when others are hidden.
- **Styling control.** Use the `colors` and `theme` props, CSS custom properties, or the `d3c-*` class names. Dark mode is built in.
- **Accessible.** Every chart has a `figure` role and an `aria-label`. Marks can be focused with the keyboard and have their own labels.

## Install

```bash
npm install d3js-charts
```

`react` and `react-dom` (18 or newer) are peer dependencies. `d3` is installed for you.

```tsx
import { BarChart } from 'd3js-charts';
import 'd3js-charts/styles.css';

export function Sales() {
  return (
    <BarChart
      title="Sales by region"
      data={[
        { label: 'North', value: 120 },
        { label: 'South', value: 80 },
      ]}
    />
  );
}
```

## Charts and data shapes

| Component | Data |
| --- | --- |
| `BarChart` | `data: { label, value, color? }[]`, `orientation`, `sort`, `showValues` |
| `GroupedBarChart` / `StackedBarChart` | `data: Record<string, string \| number>[]` (one row per category, one column per series), `categoryKey`, `keys?`, `seriesLabels?`, `orientation` |
| `LineChart` / `AreaChart` | `series: { key, label?, color?, data: { x: number \| Date, y }[] }[]`, `curve`, `showPoints`; `AreaChart` also takes `stacked` |
| `PieChart` / `DonutChart` | `data: { label, value, color? }[]`, `innerRadius` (0–1), `labels`, `centerLabel` |
| `ScatterPlot` | `series: { key, label?, data: { x, y, size?, label? }[] }[]`. If points have `size`, it becomes a bubble chart. |
| `Histogram` | `data: number[]`, `thresholds` (a bin count or an array of bin edges) |
| `Heatmap` | `data: { x, y, value }[]`, `colorInterpolator`, `showValues` |
| `Treemap` / `Sunburst` | `data: { name, value?, children? }` |
| `ForceGraph` | `nodes: { id, label?, group?, size? }[]`, `links: { source, target, value? }[]`, `draggable`, `zoomable` |

Every chart also accepts click handlers (`onBarClick`, `onSliceClick`, `onPointClick`, …), a custom tooltip (`renderTooltip`), `valueFormat`, and axis options (`xAxis` / `yAxis`, or `categoryAxis` / `valueAxis`: `label`, `ticks`, `tickFormat`, `grid`, `min`, `max`, `hide`).

### Common props

| Prop | Default | |
| --- | --- | --- |
| `width` / `height` | parent width; height from `aspectRatio` | Set a fixed size, or leave both out to make the chart responsive. |
| `aspectRatio` / `minHeight` | `1.6` / `220` | |
| `margin` | automatic | Spacing is worked out from the tick labels. Pass values to override it. |
| `colors` | built-in 8-colour palette | Either an array (used in order) or `(key, index) => colour` |
| `legend` | shown when there are 2 or more series | `false`, or `{ position: 'top' \| 'bottom' \| 'left' \| 'right', interactive, title }` |
| `animation` | on, 600ms | `false`, or `{ duration, delay, easing, stagger }` |
| `tooltip` | `true` | |
| `theme` | | `{ fontFamily, fontSize, textColor, axisColor, gridColor, tooltipBackground, … }` |
| `className` / `style` | | Applied to the chart's root element |
| `title` / `description` | | Shown as the visible title and used as the accessible name |

## Styling

`styles.css` defines every colour and font as a CSS variable on `.d3c-chart`. All its selectors use `:where()`, so they have zero specificity and your own rules always win.

```css
.my-dashboard .d3c-chart {
  --d3c-font-family: 'Inter', sans-serif;
  --d3c-series-1: #7c3aed;
  --d3c-grid: transparent;
}
.my-dashboard .d3c-bar:hover { filter: brightness(1.1); }
```

Dark mode follows the operating system setting. You can force a mode with `data-theme="dark"` or `data-theme="light"` on any ancestor element.

## Development

```bash
npm install
npm run dev        # demo page at http://localhost:5173
npm test           # unit tests (Vitest + Testing Library)
npm run typecheck
npm run build      # dist/: ESM, CJS, .d.ts, styles.css
```

The demo in `example/` imports the library straight from `src/`, so changes reload instantly. It has controls for theme, legend position, animation, shuffling data and live streaming data, plus options for each chart.
